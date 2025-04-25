import { generate_id_from_entity } from "@navara/core";
import GBufferGlobeFragShader from "@shaders/glsl/gbufferGlobe.frag.glsl";
import GBufferGlobeVertShader from "@shaders/glsl/gbufferGlobe.vert.glsl";
import type {
  MeshAdded,
  Mesh as EventMesh,
  RasterTileInternalMaterial,
  Transform,
  TextureFragment,
  MeshChanged,
} from "navara_wasm";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  GLSL3,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  RawShaderMaterial,
  RGBAFormat,
  Scene,
  SRGBColorSpace,
  Texture,
  WebGLRenderer,
  WebGLRenderTarget,
  type MagnificationTextureFilter,
  type MinificationTextureFilter,
} from "three";

import { setTransform, type BufferLoader } from "../event";
import { generateMixOverlaidTexturesMacro } from "../material";
import type { Scenes, TexturizedSceneByTileCoordinates } from "../scene";
import { toCreasedNormalsAsync } from "../tasks/toCreasedNormalsAsync";
import type { TextureOptions } from "../textures";
import type { MeshCache } from "../type";

export type TileMaterial = MeshBasicMaterial | MeshLambertMaterial;

// TODO: Replace with one resource
const GLOBE_COLOR = 0xffffff;

export class TileMesh extends Mesh<BufferGeometry, TileMaterial> {
  renderer: WebGLRenderer;
  // This is used to attach this scene as a texture to the tile.
  texturizedScene: Scene;

  // Next: Resolution should be updated according to `overscaled` value.
  texturizedSceneRenderTarget = new WebGLRenderTarget(512, 512, {
    format: RGBAFormat,
  });
  gbufferMesh = new Mesh<BufferGeometry, RawShaderMaterial>();

  constructor(
    mesh: MeshAdded,
    texturizedSceneByTileCoordinates: TexturizedSceneByTileCoordinates,
  ) {
    super();
    const coords = mesh.tile_coords;
    this.renderer = texturizedSceneByTileCoordinates.renderer;
    this.texturizedScene = texturizedSceneByTileCoordinates.get(coords);
  }

  async _init(
    scenes: Scenes,
    meshes: MeshCache,
    mesh: MeshAdded,
    buf: BufferLoader,
    loadedTexes: Map<string, Texture>,
    textureOptions: TextureOptions,
  ) {
    await this.createMesh(
      scenes,
      meshes,
      buf,
      loadedTexes,
      generate_id_from_entity(mesh),
      mesh.mesh,
      mesh.material,
      mesh.transform,
      textureOptions,
    );

    const removed = () => {
      this.gbufferMesh.removeFromParent();
      this.removeEventListener("removed", removed);
    };
    this.addEventListener("removed", removed);
  }

  private async createMesh(
    scenes: Scenes,
    meshes: MeshCache,
    buf: BufferLoader,
    loadedTexes: Map<string, Texture>,
    id: string,
    mesh: EventMesh,
    mat: RasterTileInternalMaterial,
    transform: Transform | undefined,
    textureOptions: TextureOptions,
  ) {
    let position = buf.f32(mesh.vertices);
    let indices = buf.u32(mesh.indices);
    if (!position || !indices) return;

    let geometry = new BufferGeometry();

    geometry.setAttribute("position", new BufferAttribute(position, 3));
    position.set([]);
    position = null;

    let uv = buf.f32(mesh.uvs);
    if (uv) {
      geometry.setAttribute("uv", new BufferAttribute(uv, 2));
      uv.set([]);
      uv = null;
    }

    geometry.setIndex(new BufferAttribute(indices, 1));
    indices.set([]);
    indices = null;

    if (mat.should_compute_normal_from_vertex) {
      geometry = await toCreasedNormalsAsync(geometry, Math.PI / 3);
    }

    this.geometry = geometry;

    this.material = this.initMaterial(mat, textureOptions);

    const maxTextures = textureOptions.maxTextures;
    this.setUniforms(mat, maxTextures);
    this.setupTextureFragments(mat.texture_fragments());
    this.setupTextures(loadedTexes, textureOptions, maxTextures);

    this.visible = false;
    this.renderOrder = mesh.render_order;
    this.userData.tileOrigColor = GLOBE_COLOR;
    if (transform) setTransform(this, transform);
    scenes.globe.add(this);
    meshes.set(id, this);

    this.gbufferMesh.material = new RawShaderMaterial({
      vertexShader: GBufferGlobeVertShader,
      fragmentShader: GBufferGlobeFragShader,
      glslVersion: GLSL3,
    });
    this.gbufferMesh.geometry = geometry;
    this.gbufferMesh.visible = false;
    scenes.globeGBuffer.add(this.gbufferMesh);
  }

  private initMaterial(
    mat: RasterTileInternalMaterial,
    textureOptions: TextureOptions,
  ): TileMaterial {
    if (mat.wireframe) {
      return new MeshBasicMaterial({
        color: GLOBE_COLOR,
        transparent: true,
        wireframe: true,
        stencilWrite: false,
      });
    }

    const m = mat.should_compute_normal_from_vertex
      ? new MeshLambertMaterial({
          color: GLOBE_COLOR,
          transparent: true,
          stencilWrite: false,
        })
      : new MeshBasicMaterial({
          color: GLOBE_COLOR,
          transparent: true,
          stencilWrite: false,
        });

    const maxTextures = textureOptions.maxTextures;

    m.onBeforeCompile = (shader) => {
      shader.uniforms.uShows = m.userData.shows;
      shader.uniforms.uColors = m.userData.colors;
      shader.uniforms.uOpacities = m.userData.opacities;
      shader.uniforms.uTextures = m.userData.textures;
      // shader.uniforms.uTextures0 = { value: m.userData.textures.value[0] };
      // shader.uniforms.uTextures1 = { value: m.userData.textures.value[1] };

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `
  uniform int uShows[${maxTextures}];
  uniform vec3 uColors[${maxTextures}];
  uniform float uOpacities[${maxTextures}];
  uniform sampler2D uTextures[${maxTextures}];
  // uniform sampler2D uTextures0;
  // uniform sampler2D uTextures1;
  
  #include <common>
  `,
        )
        .replace(
          "#include <map_fragment>",
          `
  ${generateMixOverlaidTexturesMacro(maxTextures)}
  diffuseColor = sampledDiffuseColor;
  `,
        );
    };

    return m;
  }

  _update(
    mesh: MeshChanged,
    loadedTexes: Map<string, Texture>,
    textureOptions: TextureOptions,
  ) {
    const changedMaterial = mesh.material;
    const active = mesh.mesh.active;

    const maxTextures = textureOptions.maxTextures;

    // TODO: Support hide entire globe.
    this.visible = active;
    this.gbufferMesh.visible = active;

    if (active) {
      this.setupTextureFragments(changedMaterial?.texture_fragments());
      this.setUniforms(changedMaterial, maxTextures);
      this.setupTextures(loadedTexes, textureOptions, maxTextures);
    }
  }

  private setUniforms(mat: RasterTileInternalMaterial, maxTextures: number) {
    const m = this.material;

    if (!m.userData.shows) {
      m.userData.shows = {
        value: [...new Array(maxTextures)].fill(0),
      };
    }
    if (!m.userData.colors) {
      m.userData.colors = {
        value: [...new Array(maxTextures)].map(() => new Color()),
      };
    }
    if (!m.userData.opacities) {
      m.userData.opacities = {
        value: [...new Array(maxTextures)].fill(1),
      };
    }

    // Reset
    for (let i = 0; i < m.userData.shows.value.length; i++) {
      m.userData.shows.value[i] = 0;
      m.userData.colors.value[i] = new Color();
      m.userData.opacities.value[i] = 1;
    }

    // All properties have same length.
    const shows = mat.shows;
    const colors = mat.colors;
    const opacities = mat.opacities;
    for (let i = 0; i < shows.length; i++) {
      m.userData.shows.value[i] = shows[i];
      m.userData.colors.value[i] = new Color(colors[i]);
      m.userData.opacities.value[i] = opacities[i];
    }

    if (!m.defines) {
      m.defines = {
        USE_UV: true,
      };
    }
  }

  private setupTextureFragments(
    textureFragments: TextureFragment[] | undefined,
  ) {
    if (!textureFragments) {
      return;
    }
    const m = this.material;
    const texturesFragmentIds = [];
    for (const fragment of textureFragments) {
      texturesFragmentIds.push(
        fragment ? generate_id_from_entity(fragment) : null,
      );
    }

    m.userData.textureFragments = {
      value: texturesFragmentIds,
    };
  }

  private setupTextures(
    loadedTexes: Map<string, Texture>,
    textureOptions: TextureOptions,
    maxTextures: number,
  ) {
    const m = this.material;

    if (!m.userData.textures) {
      m.userData.textures = {
        value: [...new Array(maxTextures)].fill(null),
      };
    }

    // Reset
    for (let i = 0; i < maxTextures; i++) {
      m.userData.textures.value[i] = null;
    }

    const textureFragments = m.userData.textureFragments?.value;
    if (!textureFragments) {
      return;
    }

    if (textureFragments.length > maxTextures) {
      console.error(
        `Exceeded maximum textures: ${textureFragments.length} layers are provided. Maximum the number of textures is ${maxTextures}.`,
      );
    }

    const textures = m.userData.textures.value;
    for (let i = 0; i < textureFragments.length; i++) {
      const textureFragment = textureFragments[i];
      const t = textureFragment ? loadedTexes.get(textureFragment) : undefined;
      if (!t) {
        textures[i] = null;
        continue;
      }

      if (t.colorSpace !== SRGBColorSpace) {
        t.colorSpace = SRGBColorSpace;
        t.minFilter = textureOptions.minFilter as MinificationTextureFilter;
        t.magFilter = textureOptions.magFilter as MagnificationTextureFilter;
        t.anisotropy = textureOptions.maxAnisotropy;
        t.generateMipmaps = textureOptions.useMipmaps;
        t.needsUpdate = true;
      }

      textures[i] = t;
    }
  }
}
