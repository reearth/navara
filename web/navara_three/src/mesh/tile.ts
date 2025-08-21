import {
  generate_id_from_entity,
  type TileHandle,
  type EventHandler,
} from "@navara/core";
import { orthoCameraTransform } from "@navara/engine";
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
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  OrthographicCamera,
  RGBAFormat,
  SRGBColorSpace,
  Texture,
  Vector2,
  WebGLRenderTarget,
  type MagnificationTextureFilter,
  type MinificationTextureFilter,
} from "three";

import type { ViewEvents } from "..";
import { setTransform, type BufferLoader, type TileHandler } from "../event";
import { generateMixOverlaidTexturesMacro } from "../material";
import type {
  SceneGroup,
  Scenes,
  TexturizedSceneByTileCoordinates,
} from "../scene";
import { toCreasedNormalsAsync } from "../tasks/toCreasedNormalsAsync";
import type { TextureOptions } from "../textures";
import type { MeshCache, TileMapByHandle } from "../type";

import { BatchedFeatureMesh } from "./batchedFeature";

export type TileMaterial = MeshBasicMaterial | MeshLambertMaterial;

// TODO: Replace with one resource
const GLOBE_COLOR = 0xffffff;

const PREV_RENDERER_CLEAR_COLOR = new Color();

export class TileMesh extends Mesh<BufferGeometry, TileMaterial> {
  handle: TileHandle;
  tileHandler: TileHandler;
  maxTextures: number;
  texturizedSceneIndexFrom: number;
  numTexturizedVector: number;
  tileStates?: {
    parentHandle?: TileHandle;
    isRendered: boolean;
    layerId: string;
  }[];

  private texturizedSceneByTileCoordinates: TexturizedSceneByTileCoordinates;
  // This is used to attach this scene as a texture to the tile.
  private texturizedScenes: SceneGroup;
  // Private camera for this tile to prevent conflicts with other tiles
  private camera = new OrthographicCamera();

  // Next: Resolution should be updated according to `overscaled` value.
  texturizedSceneRenderTargets: WebGLRenderTarget[] = [];

  constructor(
    mesh: MeshAdded,
    texturizedSceneByTileCoordinates: TexturizedSceneByTileCoordinates,
    textureOptions: TextureOptions,
    tileMapByHandle: TileMapByHandle,
    tileHandler: TileHandler,
  ) {
    super();
    const handle = mesh.tile_handle;
    this.handle = handle;

    this.texturizedSceneByTileCoordinates = texturizedSceneByTileCoordinates;

    this.texturizedScenes = texturizedSceneByTileCoordinates.get(handle);

    // Initialize the private camera by copying the shared camera
    this.camera.copy(texturizedSceneByTileCoordinates.camera);

    this.maxTextures = textureOptions.maxTextures;
    this.numTexturizedVector = textureOptions.maxTextures / 2;
    this.texturizedSceneIndexFrom = this.maxTextures - this.numTexturizedVector;

    for (let i = 0; i < this.numTexturizedVector; i++) {
      this.texturizedSceneRenderTargets.push(
        new WebGLRenderTarget(512, 512, {
          format: RGBAFormat,
        }),
      );
    }

    this.tileHandler = tileHandler;

    tileMapByHandle.set(handle, this);

    this.onBeforeRender = this._onBeforeRender;
  }

  private updateTexturizedSceneByTileState() {
    this.tileStates = [];
    const tileStates = this.tileHandler.getVectorTileStates(this.handle);
    if (!tileStates || !tileStates.length) {
      return;
    }
    for (const state of tileStates) {
      const parentHandle = state.ready_parent_tile_handle;
      const layerId = state.layer_id;

      if (!parentHandle) continue;

      this.tileStates.push({
        parentHandle,
        layerId,
        isRendered: state.is_rendered,
      });

      const scene = this.texturizedSceneByTileCoordinates.findSceneByLayerId(
        parentHandle,
        layerId,
      );
      if (!scene) continue;
      this.texturizedSceneByTileCoordinates.addFromParentScene(
        this.handle,
        layerId,
        scene,
      );
    }
  }

  private _onBeforeRender = () => {
    if (!this.visible) return;

    // This needs to be executed in every render to check parent tile state.
    // If the parent tile is available, but the child tile is still preparing, use the parent tile.
    this.updateTexturizedSceneByTileState();

    let i = -1;
    for (const texturizedScene of this.texturizedScenes.children) {
      i++;

      if (texturizedScene.userData.removed) {
        this.updateTexturizedSceneTextureVisibility(
          false,
          texturizedScene.userData.layerId,
        );
        continue;
      }

      if (!texturizedScene.children.length) continue;

      this.updateTexturizedSceneTextureVisibility(
        true,
        texturizedScene.userData.layerId,
      );

      const renderTarget = this.texturizedSceneRenderTargets[i];
      if (!renderTarget) break;

      const currentRenderTarget =
        this.texturizedSceneByTileCoordinates.renderer.getRenderTarget();
      const clearColor =
        this.texturizedSceneByTileCoordinates.renderer.getClearColor(
          PREV_RENDERER_CLEAR_COLOR,
        );

      // Get the parent tile's zoom level if available
      const tileStates = this.tileStates;
      const layerId = texturizedScene.userData.layerId;
      const state = tileStates?.find((s) => s.layerId === layerId);
      const parentHandle =
        // Parent tile should be used if this tile isn't available, or
        !state?.isRendered ||
        // this tile is still preparing in rendering engine(It means this texturized scene doesn't have a mesh except for the parent tile).
        !this.texturizedSceneByTileCoordinates.hasCurrentMesh(
          this.handle,
          layerId,
        )
          ? state?.parentHandle
          : undefined;

      this.texturizedSceneByTileCoordinates.showMeshFromParent(
        this.handle,
        layerId,
        !!parentHandle,
      );

      // Save original camera projection parameters
      const originalLeft = this.camera.left;
      const originalRight = this.camera.right;
      const originalTop = this.camera.top;
      const originalBottom = this.camera.bottom;

      // If we have a parent tile, adjust the camera to focus on the correct region.
      if (parentHandle) {
        const result = orthoCameraTransform(this.handle, parentHandle);

        // Update the camera parameters to focus on the subtile
        // Set the projection parameters directly.
        this.camera.left = result.left;
        this.camera.right = result.right;
        this.camera.top = result.top;
        this.camera.bottom = result.bottom;

        // Update the projection matrix to apply the changes
        this.camera.updateProjectionMatrix();
      }

      this.texturizedSceneByTileCoordinates.renderer.setRenderTarget(
        renderTarget,
      );
      this.texturizedSceneByTileCoordinates.renderer.setClearColor(0x000, 0); // Transparent scene
      this.texturizedSceneByTileCoordinates.renderer.clear();
      this.texturizedSceneByTileCoordinates.renderer.render(
        texturizedScene,
        this.camera, // Use the private camera instead of the shared one
      );

      // Restore camera settings
      if (parentHandle) {
        this.camera.left = originalLeft;
        this.camera.right = originalRight;
        this.camera.top = originalTop;
        this.camera.bottom = originalBottom;
        this.camera.updateProjectionMatrix();
      }

      // Restore previous renderer settings.
      this.texturizedSceneByTileCoordinates.renderer.setRenderTarget(
        currentRenderTarget,
      );
      this.texturizedSceneByTileCoordinates.renderer.setClearColor(
        clearColor,
        1,
      );

      renderTarget.texture.needsUpdate = true;
    }
  };

  async _init(
    scenes: Scenes,
    meshes: MeshCache,
    mesh: MeshAdded,
    buf: BufferLoader,
    loadedTexes: Map<string, Texture>,
    textureOptions: TextureOptions,
    tileMapByHandle: TileMapByHandle,
    viewEvents: EventHandler<ViewEvents>,
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
      tileMapByHandle,
      mesh.ready_parent_tile_handle,
      viewEvents,
    );
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
    tileMapByHandle: TileMapByHandle,
    readyParentTileHandle: TileHandle | undefined,
    viewEvents: EventHandler<ViewEvents>,
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

    this.material = this.initMaterial(mat, viewEvents);

    if (!this.material.userData.uvTransform) {
      this.material.userData.uvTransform = {
        offset: new Vector2(),
        scale: new Vector2(1, 1),
      };
    }

    const { offset, scale } = mesh.uv_transform;
    this.material.userData.uvTransform.offset.set(offset.x, offset.y);
    this.material.userData.uvTransform.scale.set(scale.x, scale.y);

    const maxTextures = this.maxTextures;
    this.setUniforms(mat, maxTextures);
    this.setupTextureFragments(
      mat.texture_fragments(),
      tileMapByHandle,
      readyParentTileHandle,
    );
    this.setupTextures(loadedTexes, textureOptions, maxTextures);

    this.castShadow = !!mat.cast_shadow;
    this.receiveShadow = !!mat.receive_shadow;

    this.visible = false;
    this.renderOrder = mesh.render_order;
    this.userData.tileOrigColor = GLOBE_COLOR;
    if (transform) setTransform(this, transform);
    scenes.globe.add(this);
    meshes.set(id, this);
  }

  private initMaterial(
    mat: RasterTileInternalMaterial,
    viewEvents: EventHandler<ViewEvents>,
  ): TileMaterial {
    if (mat.wireframe) {
      return new MeshBasicMaterial({
        color: GLOBE_COLOR,
        wireframe: true,
        stencilWrite: false,
      });
    }

    const m = mat.should_compute_normal_from_vertex
      ? new MeshLambertMaterial({
          color: GLOBE_COLOR,
          stencilWrite: false,
        })
      : new MeshBasicMaterial({
          color: GLOBE_COLOR,
          stencilWrite: false,
        });

    m.userData.uPickable = {
      value: 0,
    };

    m.defines ??= {};
    m.defines.USE_UV = 1;

    const maxTextures = this.maxTextures;

    m.onBeforeCompile = (shader) => {
      // Add UV transform uniforms
      const uvT = m.userData.uvTransform;
      shader.uniforms.uOffset = { value: uvT.offset };
      shader.uniforms.uScale = { value: uvT.scale };
      shader.uniforms.reflectivity = { value: 0 };

      shader.uniforms.uShows = m.userData.shows;
      shader.uniforms.uPickable = m.userData.uPickable;
      shader.uniforms.uColors = m.userData.colors;
      shader.uniforms.uOpacities = m.userData.opacities;
      shader.uniforms.uTextures = m.userData.textures;
      // shader.uniforms.uTextures0 = { value: m.userData.textures.value[0] };
      // shader.uniforms.uTextures1 = { value: m.userData.textures.value[1] };

      // Add UV transform uniforms to the shader
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `
uniform vec2 uOffset;
uniform vec2 uScale;

// Store original UV for MVT textures
varying vec2 vOrigUv;

#include <common>
`,
        )
        .replace(
          "#include <uv_vertex>",
          `
#include <uv_vertex>
vOrigUv = vUv;
// Apply transform for raster textures
vUv = vUv * uScale + uOffset;
`,
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `
  uniform int uShows[${maxTextures}];
  uniform vec3 uColors[${maxTextures}];
  uniform float uOpacities[${maxTextures}];
  uniform sampler2D uTextures[${maxTextures}];
  uniform float uPickable;
  
  // Add varying for original UV coordinates
  varying vec2 vOrigUv;
  
  #include <common>
  `,
        )
        .replace(
          "#include <map_fragment>",
          `
  ${generateMixOverlaidTexturesMacro(
    maxTextures,
    (texColorVar, idx) => `
    // Determine which UV coordinates to use based on texture index
    // For MVT textures (index >= this.texturizedSceneIndexFrom), use original UV
    // For raster textures, use transformed UV
    vec2 texUv = ${idx} >= ${this.texturizedSceneIndexFrom} ? vOrigUv : vUv;
    ${texColorVar} = texture2D(uTextures[${idx}], texUv) * vec4(uColors[${idx}], 1.0);
    
    // Disable picking for the raster tile.
    // Allow picking for texturizedScene because it's vector data.
    if(uPickable > 0.) {
      ${texColorVar}.xyz *= float(${idx} >= ${this.texturizedSceneIndexFrom});
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

    viewEvents.emit("_csmMounted", m);

    return m;
  }

  _update(
    mesh: MeshChanged,
    loadedTexes: Map<string, Texture>,
    textureOptions: TextureOptions,
    tileMapByHandle: TileMapByHandle,
  ) {
    const changedMaterial = mesh.material;
    const tileMesh = mesh.mesh;
    const active = tileMesh.active;
    const readyParentTileHandle = mesh.ready_parent_tile_handle;

    const maxTextures = textureOptions.maxTextures;

    // TODO: Support hide entire globe.
    this.visible = active;

    if (active) {
      // Update UV transform if available in the mesh
      const { offset, scale } = tileMesh.uv_transform;
      this.material.userData.uvTransform.offset.set(offset.x, offset.y);
      this.material.userData.uvTransform.scale.set(scale.x, scale.y);

      this.setupTextureFragments(
        changedMaterial?.texture_fragments(),
        tileMapByHandle,
        readyParentTileHandle,
      );
      this.setUniforms(changedMaterial, maxTextures);
      this.setupTextures(loadedTexes, textureOptions, maxTextures);

      this._setupSceneObserver();
    }

    if (this.castShadow !== changedMaterial.cast_shadow) {
      this.castShadow = !!changedMaterial.cast_shadow;
    }
    if (this.receiveShadow !== changedMaterial.receive_shadow) {
      this.receiveShadow = !!changedMaterial.receive_shadow;
    }
  }

  private _setupSceneObserver() {
    if (this.texturizedScenes.userData.childrenObserver) {
      this.texturizedScenes.removeEventListener(
        "childadded",
        this.texturizedScenes.userData.childrenObserver,
      );
      this.texturizedScenes.removeEventListener(
        "childremoved",
        this.texturizedScenes.userData.childrenObserver,
      );
      this.texturizedScenes.userData.childrenObserver = undefined;
    }

    const parentObserver = () => {
      for (const texturizedScene of this.texturizedScenes.children) {
        if (texturizedScene.userData.childrenObserver) {
          texturizedScene.removeEventListener(
            "childadded",
            texturizedScene.userData.childrenObserver,
          );
          texturizedScene.removeEventListener(
            "childremoved",
            texturizedScene.userData.childrenObserver,
          );
          texturizedScene.userData.childrenObserver = undefined;
        }

        const observer = () => {
          if (texturizedScene.children.length === 0) {
            this.updateTexturizedSceneTextureVisibility(
              false,
              texturizedScene.userData.layerId,
            );
          } else {
            this.updateTexturizedSceneTextureVisibility(
              true,
              texturizedScene.userData.layerId,
            );
          }
        };

        texturizedScene.userData.childrenObserver = observer;

        texturizedScene.addEventListener("childadded", observer);
        texturizedScene.addEventListener("childremoved", observer);
      }
    };

    this.texturizedScenes.userData.childrenObserver = parentObserver;

    this.texturizedScenes.addEventListener("childadded", parentObserver);
    this.texturizedScenes.addEventListener("childremoved", parentObserver);
  }

  private updateTexturizedSceneTextureVisibility(
    visible: boolean,
    layerId: string,
  ) {
    if (!this.material || !this.material.userData) return;

    const m = this.material;
    const textures = m.userData.textures?.value;
    if (!textures) return;

    const sceneIdx = this.texturizedScenes.children.findIndex(
      (c) => c.userData.layerId === layerId,
    );
    if (sceneIdx === -1) return;

    // Look for RenderTarget's texture to change visibility.
    const lastIdx = this.texturizedSceneIndexFrom + sceneIdx;
    if (textures[lastIdx]) {
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
    tileMapByHandle: TileMapByHandle,
    readyParentTileHandle: TileHandle | undefined,
  ) {
    const m = this.material;

    if (!textureFragments || !textureFragments.length) {
      if (!readyParentTileHandle) return;

      m.userData.textureFragments = tileMapByHandle.get(
        readyParentTileHandle,
      )?.material.userData.textureFragments;
      return;
    }

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

    const numTexturizedVector = this.numTexturizedVector;

    if (textureFragments.length >= this.texturizedSceneIndexFrom) {
      console.error(
        `Exceeded maximum textures: ${textureFragments.length} layers are provided. Maximum the number of textures is ${this.texturizedSceneIndexFrom}.`,
      );
    }

    const textures = m.userData.textures.value;

    // Setting tile textures
    for (let i = 0; i < textureFragments.length; i++) {
      if (i >= this.texturizedSceneIndexFrom) {
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

    for (let i = 0; i < numTexturizedVector; i++) {
      // texturizedSceneRenderTarget should be added always due to GLSL spec.
      const lastIndex = this.texturizedSceneIndexFrom + i;
      const texturizedSceneTexture =
        this.texturizedSceneRenderTargets[i].texture;
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
        (this.texturizedScenes.children[i]?.children.length ?? 0 > 0) ? 1 : 0;
      m.userData.colors.value[lastIndex] = new Color(0xffffff);
      m.userData.opacities.value[lastIndex] = 1.0;
    }
  }

  _togglePickable(pickable: number) {
    if (pickable) {
      this.material.color.setHex(0);
    } else {
      this.material.color.setHex(this.userData.tileOrigColor);
    }
    this.material.userData.uPickable.value = pickable;

    for (const texturizedScene of this.texturizedScenes.children) {
      texturizedScene.traverse((obj) => {
        if (obj instanceof BatchedFeatureMesh) {
          obj._togglePickable(pickable);
        }
      });
    }
  }
}
