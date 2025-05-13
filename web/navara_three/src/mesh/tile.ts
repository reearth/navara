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
  OrthographicCamera,
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

import { BatchedFeatureMesh } from "./batchedFeature";

export type TileMaterial = MeshBasicMaterial | MeshLambertMaterial;

// TODO: Replace with one resource
const GLOBE_COLOR = 0xffffff;

const PREV_RENDERER_CLEAR_COLOR = new Color();

export class TileMesh extends Mesh<BufferGeometry, TileMaterial> {
  renderer: WebGLRenderer;
  // This is used to attach this scene as a texture to the tile.
  texturizedScene: Scene;

  // Next: Resolution should be updated according to `overscaled` value.
  texturizedSceneRenderTarget = new WebGLRenderTarget(512, 512, {
    format: RGBAFormat,
  });
  gbufferMesh = new Mesh<BufferGeometry, RawShaderMaterial>();
  private _camera: OrthographicCamera;

  constructor(
    mesh: MeshAdded,
    texturizedSceneByTileCoordinates: TexturizedSceneByTileCoordinates,
  ) {
    super();
    const coords = mesh.tile_coords;
    this.renderer = texturizedSceneByTileCoordinates.renderer;
    this.texturizedScene = texturizedSceneByTileCoordinates.get(coords);
    this._camera = texturizedSceneByTileCoordinates.camera;

    this.onBeforeRender = this._onBeforeRender;
  }

  private _onBeforeRender = () => {
    if (!this.visible) return;

    if (this.texturizedScene.userData.removed) {
      this.updateTexturizedSceneTextureVisibility(false);
    }

    if (this.texturizedScene.userData.needsUpdate) {
      const currentRenderTarget = this.renderer.getRenderTarget();
      const clearColor = this.renderer.getClearColor(PREV_RENDERER_CLEAR_COLOR);

      this.renderer.setRenderTarget(this.texturizedSceneRenderTarget);
      this.renderer.setClearColor(0x000, 0); // Transparent scene
      this.renderer.clear();
      this.renderer.render(this.texturizedScene, this._camera);

      // Restore previous renderer settings.
      this.renderer.setRenderTarget(currentRenderTarget);
      this.renderer.setClearColor(clearColor, 1);

      this.texturizedScene.userData.needsUpdate = false;

      this.texturizedSceneRenderTarget.texture.needsUpdate = true;
    }
  };

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

    m.userData.uPickable = {
      value: 0,
    };

    const maxTextures = textureOptions.maxTextures;

    m.onBeforeCompile = (shader) => {
      shader.uniforms.uShows = m.userData.shows;
      shader.uniforms.uPickable = m.userData.uPickable;
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
  uniform float uPickable;
  // uniform sampler2D uTextures0;
  // uniform sampler2D uTextures1;
  
  #include <common>
  `,
        )
        .replace(
          "#include <map_fragment>",
          `
  ${generateMixOverlaidTexturesMacro(
    maxTextures,
    (texColorVar, idx) => `
    // Disable picking for the raster tile.
    // Allow picking for texturizedScene because it's vector data.
    if(uPickable > 0.) {
      ${texColorVar}.xyz *= float(${maxTextures - 1} == ${idx});
    }
  `,
  )}
  diffuseColor = sampledDiffuseColor;
  `,
        )
        .replace(
          "#include <envmap_fragment>",
          `
if (uPickable > 0.) {
  outgoingLight = diffuseColor.xyz;
}

  #include <envmap_fragment>
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

      this._setupSceneObserver();
    }
  }

  private _setupSceneObserver() {
    if (this.texturizedScene.userData.childrenObserver) {
      this.texturizedScene.removeEventListener(
        "childadded",
        this.texturizedScene.userData.childrenObserver,
      );
      this.texturizedScene.removeEventListener(
        "childremoved",
        this.texturizedScene.userData.childrenObserver,
      );
      this.texturizedScene.userData.childrenObserver = undefined;
    }

    const observer = () => {
      if (this.texturizedScene.children.length === 0) {
        this.updateTexturizedSceneTextureVisibility(false);
      } else {
        this.updateTexturizedSceneTextureVisibility(true);
        this.texturizedScene.userData.needsUpdate = true;
      }
    };

    this.texturizedScene.userData.childrenObserver = observer;

    this.texturizedScene.addEventListener("childadded", observer);
    this.texturizedScene.addEventListener("childremoved", observer);
  }

  private updateTexturizedSceneTextureVisibility(visible: boolean) {
    if (!this.material || !this.material.userData) return;

    const m = this.material;
    const textures = m.userData.textures?.value;
    if (!textures) return;

    // Look for RenderTarget's texture to change visibility.
    const lastIdx = textures.length - 1;
    if (textures[lastIdx] === this.texturizedSceneRenderTarget.texture) {
      m.userData.shows.value[lastIdx] = visible ? 1 : 0;
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

    if (textureFragments.length > maxTextures - 1) {
      console.error(
        `Exceeded maximum textures: ${textureFragments.length} layers are provided. Maximum the number of textures is ${maxTextures - 1}.`,
      );
    }

    const textures = m.userData.textures.value;

    // Setting tile textures
    for (let i = 0; i < textureFragments.length; i++) {
      if (i >= maxTextures - 1) {
        break;
      }

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

    // texturizedSceneRenderTarget should be added always due to GLSL spec.
    const lastIndex = maxTextures - 1;
    const texturizedSceneTexture = this.texturizedSceneRenderTarget.texture;
    // Don't need it. If you want to set it, you need to consider the color space on picking scene.
    // texturizedSceneTexture.colorSpace = SRGBColorSpace;
    texturizedSceneTexture.minFilter =
      textureOptions.minFilter as MinificationTextureFilter;
    texturizedSceneTexture.magFilter =
      textureOptions.magFilter as MagnificationTextureFilter;
    texturizedSceneTexture.anisotropy = textureOptions.maxAnisotropy;
    texturizedSceneTexture.generateMipmaps = textureOptions.useMipmaps;
    texturizedSceneTexture.needsUpdate = true;

    textures[lastIndex] = texturizedSceneTexture;

    m.userData.shows.value[lastIndex] =
      this.texturizedScene.children.length > 0 ? 1 : 0;
    m.userData.colors.value[lastIndex] = new Color(0xffffff);
    m.userData.opacities.value[lastIndex] = 1.0;
  }

  _togglePickable(pickable: number) {
    if (pickable) {
      this.material.color.setHex(0);
    } else {
      this.material.color.setHex(this.userData.tileOrigColor);
    }
    this.material.userData.uPickable.value = pickable;

    let needsUpdate = false;
    this.texturizedScene.traverse((obj) => {
      if (obj instanceof BatchedFeatureMesh) {
        obj._togglePickable(pickable);
        needsUpdate = true;
      }
    });
    if (needsUpdate) {
      this.texturizedScene.userData.needsUpdate = true;
    }
  }
}
