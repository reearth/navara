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
  Globe,
} from "@navara/engine";
import SpecularParsFragment from "@shaders/glsl/chunks/spucular_pars_fragment.glsl";
import ElevationParsFragment from "@shaders/glsl/chunks/elevation_pars_fragment.glsl";
import WaterParsFragment from "@shaders/glsl/chunks/water_pars_fragment.glsl?raw";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  NearestFilter,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  OrthographicCamera,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  LinearSRGBColorSpace,
  Texture,
  Vector2,
  Vector3,
  AddOperation,
  WebGLRenderTarget,
  type MagnificationTextureFilter,
  type MinificationTextureFilter,
  ShaderChunk,
} from "three";

import {
  PolygonMesh,
  TEXTURE_LOADER,
  WATER_NORMAL_URL,
  type ViewEvents,
} from "..";
import { setTransform, type BufferLoader, type TileHandler } from "../event";
import { generateMixOverlaidTexturesMacro } from "../material";
import type { CustomObject3DEventMap } from "../object3DEvent";
import type {
  SceneGroup,
  Scenes,
  TexturizedSceneByTileCoordinates,
} from "../scene";
import { toCreasedNormalsAsync } from "../tasks/toCreasedNormalsAsync";
import type { TextureOptions } from "../textures";
import type { MeshCache, TileMapByHandle } from "../type";
import type { CommonUniforms } from "../uniforms";
import { createReplacer } from "../utils";

import { BatchedFeatureMesh } from "./batchedFeature";
import type { PickableMesh } from "./pickableMesh";

export type TileMaterial = MeshBasicMaterial | MeshLambertMaterial;

const PREV_RENDERER_CLEAR_COLOR = new Color();

const NUM_ADDITIONAL_TEXTURES = 3; // For water normal map, color map, etc.

export class TileMesh
  extends Mesh<BufferGeometry, TileMaterial, CustomObject3DEventMap>
  implements PickableMesh
{
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
    this.numTexturizedVector =
      Math.floor(textureOptions.maxTextures / 2) - NUM_ADDITIONAL_TEXTURES;
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
    const prevStates = [...(this.tileStates ?? [])];
    this.tileStates = [];
    const tileStates = this.tileHandler.getVectorTileStates(this.handle) ?? [];
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
      this.texturizedSceneByTileCoordinates.setNeedsUpdate(this.handle, true);
    }

    if (prevStates.length !== this.tileStates.length) {
      this.texturizedSceneByTileCoordinates.setNeedsUpdate(this.handle, true);
    }
  }

  private _onBeforeRender = () => {
    if (!this.visible) return;

    // This needs to be executed in every render to check parent tile state.
    // If the parent tile is available, but the child tile is still preparing, use the parent tile.
    this.updateTexturizedSceneByTileState();

    if (!this.texturizedSceneByTileCoordinates.getNeedsUpdate(this.handle))
      return;

    this.texturizedSceneByTileCoordinates.setNeedsUpdate(this.handle, false);

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
    uniforms: CommonUniforms,
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
      uniforms,
      mesh.globe,
    );

    this.addEventListener("removedFromWorld", () => {
      this.dispose(viewEvents);
    });
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
    uniforms: CommonUniforms,
    globe: Globe,
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

    if (globe.shouldComputeNormalFromVertex) {
      geometry = await toCreasedNormalsAsync(geometry, Math.PI / 3);
    }

    this.geometry = geometry;

    this.material = this.initMaterial(mat, viewEvents, uniforms, globe);

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
    this.setupTextures(loadedTexes, textureOptions, maxTextures, mat);

    this.castShadow = !!mat.cast_shadow;
    this.receiveShadow = !!mat.receive_shadow;

    this.visible = false;
    this.renderOrder = mesh.render_order;
    this.userData.tileOrigColor = globe.color;
    if (transform) setTransform(this, transform);
    scenes.globe.add(this);
    meshes.set(id, this);
  }

  private initMaterial(
    _mat: RasterTileInternalMaterial,
    viewEvents: EventHandler<ViewEvents>,
    uniforms: CommonUniforms,
    globe: Globe,
  ): TileMaterial {
    const hasNormal = !!globe.shouldComputeNormalFromVertex;
    const m = hasNormal
      ? new MeshLambertMaterial({
          stencilWrite: false,
          color: globe.color,
        })
      : new MeshBasicMaterial({
          stencilWrite: false,
          color: globe.color,
        });

    m.userData.uPickable = {
      value: 0,
    };

    m.userData.waterTexture = {
      value: null,
    };

    m.userData.uTime = uniforms.time;

    m.userData.defines ??= {};
    m.userData.defines.USE_UV = 1;
    m.userData.defines.USE_ELEVATION_HEATMAP = 0;

    m.envMap = uniforms.tSkyEnvMap.value ?? null;
    m.combine = AddOperation;

    const maxTextures = this.maxTextures;

    m.onBeforeCompile = (shader) => {
      shader.defines ??= {};
      Object.assign(shader.defines, m.userData.defines);
      // Add UV transform uniforms
      const uvT = m.userData.uvTransform;
      shader.uniforms.uOffset = { value: uvT.offset };
      shader.uniforms.uScale = { value: uvT.scale };
      shader.uniforms.reflectivity = { value: 0 };

      shader.uniforms.uShows = m.userData.shows;
      shader.uniforms.uPickable = m.userData.uPickable;
      shader.uniforms.uColors = m.userData.colors;
      shader.uniforms.uOpacities = m.userData.opacities;
      shader.uniforms.uReflectivities = m.userData.reflectivities;
      shader.uniforms.uRoughnesses = m.userData.roughnesses;
      shader.uniforms.uWaters = m.userData.waters;
      shader.uniforms.uWaterScaleNormals = m.userData.waterScaleNormals;
      shader.uniforms.uWaterSpeeds = m.userData.waterSpeeds;
      shader.uniforms.uShininesses = m.userData.shininesses;
      shader.uniforms.uSpecularStrengths = m.userData.specularStrengths;
      shader.uniforms.uApplyWaterNormals = m.userData.applyWaterNormals;
      shader.uniforms.uSpeculars = m.userData.speculars;
      shader.uniforms.uTextures = m.userData.textures;
      shader.uniforms.uWaterNormalMap = m.userData.waterTexture;
      shader.uniforms.uColorMapTexture = uniforms.colorMapTexture;
      shader.uniforms.uIor = { value: 1.33333 };
      shader.uniforms.uTime = m.userData.uTime;

      // Elevation Heatmap uniforms
      shader.uniforms.uIsElevationHeatmaps = m.userData.isElevationHeatmaps;
      shader.uniforms.uElevationRGBScaler = m.userData.elevationRGBScaler;
      shader.uniforms.uElevationMinMaxHeightAndBoundary =
        m.userData.elevationMinMaxHeightAndBoundary;
      shader.uniforms.uElevationMinMaxOffsetAndEpsilonAndOffset =
        m.userData.elevationMinMaxOffsetAndEpsilonAndOffset;
      shader.uniforms.uLogarithmic = m.userData.logarithmic;
      shader.uniforms.uLogBase = m.userData.logBase;
      shader.uniforms.uLogBoundary = m.userData.logBoundary;

      // Add UV transform uniforms to the shader
      shader.vertexShader = createReplacer(shader.vertexShader)
        .replace(
          "#include <common>",
          `
uniform vec2 uOffset;
uniform vec2 uScale;

// Store original UV for MVT textures
varying vec2 vOrigUv;
varying vec3 vPosition;

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
        )
        .replace(
          "#include <envmap_vertex>",
          `
  #include <envmap_vertex>
  vPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
  `,
        ).source;

      shader.fragmentShader = createReplacer(shader.fragmentShader)
        .replace(
          "#include <common>",
          `
  uniform int uShows[${maxTextures}];
  uniform vec3 uColors[${maxTextures}];
  uniform float uOpacities[${maxTextures}];
  uniform float uReflectivities[${maxTextures}];
  uniform float uRoughnesses[${maxTextures}];
  uniform bool uWaters[${maxTextures}];
  uniform float uWaterScaleNormals[${maxTextures}];
  uniform float uWaterSpeeds[${maxTextures}];
  uniform float uShininesses[${maxTextures}];
  uniform float uSpecularStrengths[${maxTextures}];
  uniform float uApplyWaterNormals[${maxTextures}];
  uniform bool uSpeculars[${maxTextures}];
  uniform sampler2D uTextures[${maxTextures}];
  uniform bool uIsElevationHeatmaps[${maxTextures}];
  uniform sampler2D uWaterNormalMap;
  uniform float uPickable;
  uniform float uIor;
  uniform float uTime;

  // Add varying for original UV coordinates
  varying vec2 vOrigUv;

  #include <common>

  // uColorMapTexture is used for elevation heatmap color mapping
  ${ElevationParsFragment}

  `,
        )
        .replaceWithCondition(
          "#include <lights_lambert_pars_fragment>",
          `
        #include <lights_lambert_pars_fragment>

        ${WaterParsFragment}
        ${SpecularParsFragment}
        `,
          hasNormal,
        )
        .replace(
          "#include <map_fragment>",
          `
  float tileReflectivity;
  float tileRoughness;
  bool useWater;
  float waterScaleNormal = 0.0;
  float waterSpeed = 0.0;
  float waterShininess = 30.0;
  float waterSpecularStrength = 1.0;
  float applyWaterNormals = 0.0;
  bool useSpecular = false;

  ${generateMixOverlaidTexturesMacro(
    maxTextures,
    (texColorVar, idx) => `
    // Determine which UV coordinates to use based on texture index
    // For MVT textures (index >= this.texturizedSceneIndexFrom), use original UV
    // For raster textures, use transformed UV
    vec2 texUv = ${idx} >= ${this.texturizedSceneIndexFrom} ? vOrigUv : vUv;

    #ifdef USE_ELEVATION_HEATMAP
      // Check if this is an elevation heatmap texture
      if (uIsElevationHeatmaps[${idx}]) {
        // For elevation heatmap: decode DEM data and apply color mapping
        vec4 elevationColor = texture2D(uTextures[${idx}], texUv);
        float normalized_h = decodeElevationNormal(elevationColor);
        ${texColorVar} = vec4(texture2D(uColorMapTexture, vec2(normalized_h, 0.5)).rgb, 1.0);
      }
      else {
        ${texColorVar} = texture2D(uTextures[${idx}], texUv) * vec4(uColors[${idx}], 1.0);
      }
    #else
      // For regular textures: use color as-is
      ${texColorVar} = texture2D(uTextures[${idx}], texUv) * vec4(uColors[${idx}], 1.0);
    #endif

    float currentReflectivity = uReflectivities[${idx}];
    float currentRoughness = uRoughnesses[${idx}];
    bool currentWater = uWaters[${idx}];
    float currentWaterScaleNormal = uWaterScaleNormals[${idx}];
    float currentWaterSpeed = uWaterSpeeds[${idx}];
    float currentShininess = uShininesses[${idx}];
    float currentSpecularStrength = uSpecularStrengths[${idx}];
    float currentApplyWaterNormals = uApplyWaterNormals[${idx}];
    bool currentSpecular = uSpeculars[${idx}];

    if(${texColorVar}.a > 0.0) {
      tileReflectivity = currentReflectivity;
      tileRoughness = currentRoughness;
      useWater = currentWater;
      waterScaleNormal = currentWaterScaleNormal;
      waterSpeed = currentWaterSpeed;
      waterShininess = currentShininess;
      waterSpecularStrength = currentSpecularStrength;
      applyWaterNormals = currentApplyWaterNormals;
      useSpecular = currentSpecular;
    }

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
        .replaceWithCondition(
          "#include <normal_fragment_maps>",
          `
  vec3 origNormal = vec3(normal);
  vec3 specular;
  if(useWater) {
    specular = computeWaterSpecular(
      uWaterNormalMap,
      (vPosition.xy + vPosition.zy + vPosition.xz) / 3.0 * waterScaleNormal,
      uTime * waterSpeed,
      vViewPosition,
      normalMatrix,
      origNormal,
      waterShininess,
      waterSpecularStrength,
      diffuseColor.rgb,
      normal
    );
  } else if(useSpecular) {
    specular = computeSpecular(
      vViewPosition,
      origNormal,
      waterShininess,
      waterSpecularStrength,
      uIor
    );
    #include <normal_fragment_maps>
  } else {
   #include <normal_fragment_maps>
  }
  `,
          hasNormal,
        )
        .replaceWithCondition(
          "vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;",
          `
          vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
          outgoingLight += specular;
        `,
          hasNormal,
        )
        .replace(
          "#include <envmap_fragment>",
          `
if (uPickable > 0.) {
  outgoingLight = diffuseColor.xyz;
}

  #include <envmap_fragment>
`,
        )
        .replace(
          "#include <envmap_fragment>",
          createReplacer(ShaderChunk.envmap_fragment).replace(
            "outgoingLight += envColor.xyz * specularStrength * reflectivity;",
            "outgoingLight += envColor.xyz * specularStrength * tileReflectivity;",
          ).source,
        )
        .replaceWithCondition(
          "outputBuffer1 = vec4(packNormalToVec2(normal), reflectivity, roughnessFactor);",
          `vec3 finalNormal = mix(origNormal, normalize(origNormal * 0.7 + normal), applyWaterNormals);
          outputBuffer1 = vec4(packNormalToVec2(finalNormal), tileReflectivity, tileRoughness);`,
          hasNormal,
        ).source;
    };

    viewEvents.emit("_csmMounted", m);

    return m;
  }

  _update(
    mesh: MeshChanged,
    loadedTexes: Map<string, Texture>,
    textureOptions: TextureOptions,
    tileMapByHandle: TileMapByHandle,
    globe: Globe,
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
      this.setupTextures(
        loadedTexes,
        textureOptions,
        maxTextures,
        changedMaterial,
      );

      this._setupSceneObserver();

      this.texturizedSceneByTileCoordinates.setNeedsUpdate(this.handle, true);
    }

    if (this.castShadow !== changedMaterial.cast_shadow) {
      this.castShadow = !!changedMaterial.cast_shadow;
    }
    if (this.receiveShadow !== changedMaterial.receive_shadow) {
      this.receiveShadow = !!changedMaterial.receive_shadow;
    }
    if (this.material.color.getHex() !== globe.color) {
      this.material.color.setHex(globe.color);
      this.userData.tileOrigColor = globe.color;
    }
    if (this.material.transparent !== globe.transparent) {
      this.material.transparent = globe.transparent;
      this.material.needsUpdate = true;
    }
    if (this.material.opacity !== globe.opacity) {
      this.material.opacity = globe.opacity;
    }
    if (this.material.wireframe !== globe.wireframe) {
      this.material.wireframe = globe.wireframe;
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
          this.texturizedSceneByTileCoordinates.setNeedsUpdate(
            this.handle,
            true,
          );
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

      const mesh = this.texturizedScenes.children[sceneIdx].children[0];
      if (mesh instanceof Mesh && mesh.material instanceof Material) {
        m.userData.reflectivities.value[lastIdx] =
          mesh.material.userData.reflectivity.value;
        m.userData.roughnesses.value[lastIdx] =
          mesh.material.userData.roughness.value;
        if (mesh instanceof PolygonMesh) {
          m.userData.waters.value[lastIdx] = mesh.water;
          m.userData.waterScaleNormals.value[lastIdx] =
            mesh.material.userData.waterScaleNormal?.value ?? 0;
          m.userData.waterSpeeds.value[lastIdx] =
            mesh.material.userData.waterSpeed?.value ?? 0;
          m.userData.shininesses.value[lastIdx] =
            mesh.material.userData.shininess?.value ?? 0;
          m.userData.specularStrengths.value[lastIdx] =
            mesh.material.userData.specularStrength?.value ?? 0;
          m.userData.applyWaterNormals.value[lastIdx] =
            mesh.material.userData.applyWaterNormal?.value ?? 0;
          m.userData.speculars.value[lastIdx] =
            mesh.material.userData.specular?.value ?? false;
          // Load water normal map texture if water is enabled
          if (mesh.water) {
            this.loadWaterTexture();
          }
        }
      }
    }
  }

  // Just one water texture is available, since the maximum number of textures is restricted by GPU.
  private loadWaterTexture() {
    if (!this.material.userData.waterTexture.value) {
      // TODO: Get URL from material setting.
      this.material.userData.waterTexture.value = TEXTURE_LOADER.load(
        WATER_NORMAL_URL,
        (texture) => {
          texture.wrapS = texture.wrapT = RepeatWrapping;
        },
      );
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
    if (!m.userData.reflectivities) {
      m.userData.reflectivities = {
        value: [...new Array(maxTextures)].fill(0),
      };
    }
    if (!m.userData.roughnesses) {
      m.userData.roughnesses = {
        value: [...new Array(maxTextures)].fill(0),
      };
    }
    if (!m.userData.waters) {
      m.userData.waters = {
        value: [...new Array(maxTextures)].fill(false),
      };
    }
    if (!m.userData.waterScaleNormals) {
      m.userData.waterScaleNormals = {
        value: [...new Array(maxTextures)].fill(0),
      };
    }
    if (!m.userData.waterSpeeds) {
      m.userData.waterSpeeds = {
        value: [...new Array(maxTextures)].fill(0),
      };
    }
    if (!m.userData.shininesses) {
      m.userData.shininesses = {
        value: [...new Array(maxTextures)].fill(0),
      };
    }
    if (!m.userData.specularStrengths) {
      m.userData.specularStrengths = {
        value: [...new Array(maxTextures)].fill(0),
      };
    }
    if (!m.userData.applyWaterNormals) {
      m.userData.applyWaterNormals = {
        value: [...new Array(maxTextures)].fill(0),
      };
    }
    if (!m.userData.speculars) {
      m.userData.speculars = {
        value: [...new Array(maxTextures)].fill(false),
      };
    }

    // Elevation Heatmap uniforms
    if (!m.userData.isElevationHeatmaps) {
      m.userData.isElevationHeatmaps = {
        value: [...new Array(maxTextures)].fill(false),
      };
    }
    if (!m.userData.elevationRGBScaler) {
      m.userData.elevationRGBScaler = {
        value: new Vector3(0, 0, 0),
      };
    }
    if (!m.userData.elevationMinMaxHeightAndBoundary) {
      m.userData.elevationMinMaxHeightAndBoundary = {
        value: new Vector3(0, 0, 0), // minHeight, maxHeight, boundary
      };
    }
    if (!m.userData.elevationMinMaxOffsetAndEpsilonAndOffset) {
      m.userData.elevationMinMaxOffsetAndEpsilonAndOffset = {
        value: { x: 0, y: 0, z: 0, w: 0 }, // minOffset, maxOffset, epsilon, offset
      };
    }
    if (!m.userData.logarithmic) {
      m.userData.logarithmic = {
        value: false,
      };
    }
    if (!m.userData.logBase) {
      m.userData.logBase = {
        value: 10,
      };
    }
    if (!m.userData.logBoundary) {
      m.userData.logBoundary = {
        value: 10,
      };
    }

    // Reset all texture properties
    for (let i = 0; i < m.userData.shows.value.length; i++) {
      m.userData.shows.value[i] = 0;
      m.userData.colors.value[i] = new Color();
      m.userData.opacities.value[i] = 1;
      m.userData.isElevationHeatmaps.value[i] = false; // Reset elevation heatmap flags
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

    // Update elevation heatmap parameters from Rust material
    if (mat.is_elevation_heatmaps && mat.is_elevation_heatmaps.length > 0) {
      for (
        let i = 0;
        i < Math.min(mat.is_elevation_heatmaps.length, maxTextures);
        i++
      ) {
        m.userData.isElevationHeatmaps.value[i] =
          mat.is_elevation_heatmaps[i] !== 0;
      }
    }

    m.userData.elevationRGBScaler.value = new Vector3(
      mat.elevation_r_scaler,
      mat.elevation_g_scaler,
      mat.elevation_b_scaler,
    );

    m.userData.elevationMinMaxHeightAndBoundary.value = new Vector3(
      mat.elevation_min_height,
      mat.elevation_max_height,
      mat.elevation_boundary,
    );

    m.userData.elevationMinMaxOffsetAndEpsilonAndOffset.value = {
      x: mat.elevation_min_offset,
      y: mat.elevation_max_offset,
      z: mat.elevation_epsilon,
      w: mat.elevation_offset,
    };

    m.userData.logarithmic.value = mat.logarithmic;
    m.userData.logBase.value = Math.log(mat.log_boundary);
    m.userData.logBoundary.value = mat.log_boundary;

    if (!m.userData.defines) {
      m.userData.defines = {
        USE_UV: 1,
        USE_ELEVATION_HEATMAP: 0,
      };
    }

    m.userData.defines.USE_ELEVATION_HEATMAP =
      m.userData.isElevationHeatmaps.value.some((v: boolean) => v === true);
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
    mat: RasterTileInternalMaterial,
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

      // Use LinearSRGBColorSpace for elevation heatmap textures to preserve RGB values for DEM data
      // For regular textures, use SRGBColorSpace for proper color display
      const isElevationHeatmap =
        mat.is_elevation_heatmaps && mat.is_elevation_heatmaps[i];
      const targetColorSpace = isElevationHeatmap
        ? LinearSRGBColorSpace
        : SRGBColorSpace;

      if (t.colorSpace !== targetColorSpace) {
        t.colorSpace = targetColorSpace;
        // CRITICAL: DEM textures must use NearestFilter to prevent interpolation
        // Linear interpolation between ocean RGB(128,0,0) and land RGB(0,0,5)
        // produces intermediate values like RGB(64,0,2) which decode to ~42000m!
        t.minFilter = isElevationHeatmap
          ? NearestFilter
          : (textureOptions.minFilter as MinificationTextureFilter);
        t.magFilter = isElevationHeatmap
          ? NearestFilter
          : (textureOptions.magFilter as MagnificationTextureFilter);
        t.anisotropy = textureOptions.maxAnisotropy;
        t.generateMipmaps = isElevationHeatmap
          ? false
          : textureOptions.useMipmaps;
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

  _setPickable(pickable: boolean): void {
    if (pickable) {
      this.material.color.setHex(0);
    } else {
      this.material.color.setHex(this.userData.tileOrigColor);
    }
    this.material.userData.uPickable.value = pickable ? 1 : 0;

    for (const texturizedScene of this.texturizedScenes.children) {
      texturizedScene.traverse((obj) => {
        if (obj instanceof BatchedFeatureMesh) {
          obj._setPickable(pickable);
        }
      });
    }
  }

  dispose(viewEvents: EventHandler<ViewEvents>) {
    viewEvents.emit("_csmUnmounted", this.material);
  }
}
