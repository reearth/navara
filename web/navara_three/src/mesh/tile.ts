import { generate_id_from_entity, type TileHandle } from "@navara/core";
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
import { getWGS84SemiMajorAxis } from "@navara/three_api";
import ElevationParsFragment from "@shaders/glsl/chunks/elevation_pars_fragment.glsl";
import HillshadeParsFragment from "@shaders/glsl/chunks/hillshade_pars_fragment.glsl";
import SpecularParsFragment from "@shaders/glsl/chunks/spucular_pars_fragment.glsl";
import WaterParsFragment from "@shaders/glsl/chunks/water_pars_fragment.glsl?raw";

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  NearestFilter,
  Mesh,
  MeshLambertMaterial,
  OrthographicCamera,
  RGBAFormat,
  SRGBColorSpace,
  Texture,
  Vector2,
  Vector3,
  Vector4,
  AddOperation,
  WebGLRenderTarget,
  type MagnificationTextureFilter,
  type MinificationTextureFilter,
  ShaderChunk,
  Box3,
  Box3Helper,
  Sphere,
  NoColorSpace,
} from "three";

import { PolygonMesh } from "..";
import type { ViewContext } from "../core";
import { setTransform, type BufferLoader, type TileHandler } from "../event";
import {
  generateMixOverlaidTexturesMacro,
  generateHillshadeNormalShader,
} from "../material";
import {
  type TextureSlot,
  updateTextureFragmentIndex,
  removeTextureFragmentIndex,
} from "../utils/textureFragmentIndex";
import type { CustomObject3DEventMap } from "../object3DEvent";
import type {
  SceneGroup,
  Scenes,
  TexturizedSceneByTileCoordinates,
} from "../scene";
import type { TextureOptions } from "../textures";
import type { MeshCache, TileMapByHandle } from "../type";
import type { CommonUniforms } from "../uniforms";
import { createReplacer } from "../utils";

import type { PickableMesh } from "./pickableMesh";

export type TileMaterial = MeshLambertMaterial;

const PREV_RENDERER_CLEAR_COLOR = new Color();

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

  // Separate mesh for shadow casting (uses terrain-only geometry without skirt)
  private shadowMesh?: Mesh<BufferGeometry, TileMaterial>;

  private texturizedSceneByTileCoordinates: TexturizedSceneByTileCoordinates;
  // This is used to attach this scene as a texture to the tile.
  private texturizedScenes: SceneGroup;
  // Private camera for this tile to prevent conflicts with other tiles
  private camera = new OrthographicCamera();

  texturizedSceneRenderTargets: WebGLRenderTarget[] = [];

  private warnedExceededTextures = false;

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

    // Calculate numAdditionalTextures based on which additional textures are in use
    const additionalTexturesInUse =
      textureOptions.additionalTexturesInUse ?? {};
    let numAdditionalTextures = 0;
    if (additionalTexturesInUse.waterTexture) numAdditionalTextures++;
    if (additionalTexturesInUse.colorMapTexture) numAdditionalTextures++;

    this.numTexturizedVector =
      Math.floor(textureOptions.maxTextures / 2) - numAdditionalTextures;
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

      if (parentHandle == null) continue;

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

    // Warn if MVT layers exceed available slots
    const numScenes = this.texturizedScenes.children.length;
    if (numScenes > this.numTexturizedVector) {
      if (!this.warnedExceededTextures) {
        this.warnedExceededTextures = true;
        console.warn(
          `[TileMesh] Exceeded maximum MVT texture slots: ${numScenes} layers requested, ` +
            `but only ${this.numTexturizedVector} slots available. ` +
            `Some MVT layers will not be rendered.`,
        );
      }
    } else {
      this.warnedExceededTextures = false;
    }

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

      if (!texturizedScene.children.length) {
        this.updateTexturizedSceneTextureVisibility(
          false,
          texturizedScene.userData.layerId,
        );
        continue;
      }

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

  private _viewContext?: ViewContext;

  async _init(
    scenes: Scenes,
    meshes: MeshCache,
    mesh: MeshAdded,
    buf: BufferLoader,
    loadedTexes: Map<string, Texture>,
    textureOptions: TextureOptions,
    tileMapByHandle: TileMapByHandle,
    textureFragmentIndex: Map<string, Set<TextureSlot>>,
    tileMeshToFragmentIds: Map<TileMesh, Set<string>>,
    viewContext: ViewContext,
    uniforms: CommonUniforms,
  ) {
    this._viewContext = viewContext;

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
      textureFragmentIndex,
      tileMeshToFragmentIds,
      mesh.ready_parent_tile_handle,
      uniforms,
      mesh.globe,
    );

    this.addEventListener("removedFromWorld", () => {
      this.dispose(
        tileMapByHandle,
        textureFragmentIndex,
        tileMeshToFragmentIds,
      );
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
    textureFragmentIndex: Map<string, Set<TextureSlot>>,
    tileMeshToFragmentIds: Map<TileMesh, Set<string>>,
    readyParentTileHandle: TileHandle | undefined,
    uniforms: CommonUniforms,
    globe: Globe,
  ) {
    const position = buf.f32(mesh.vertices);
    const indices = buf.u32(mesh.indices);
    if (!position || !indices) return;

    // Create terrain-only geometry (for shadow rendering)
    // Use .slice() to copy arrays since we need the originals for combined geometry
    const terrainGeometry = new BufferGeometry();
    terrainGeometry.setAttribute(
      "position",
      new BufferAttribute(position.slice(), 3),
    );

    const uv = buf.f32(mesh.uvs);
    if (uv) {
      terrainGeometry.setAttribute("uv", new BufferAttribute(uv.slice(), 2));
    }

    terrainGeometry.setIndex(new BufferAttribute(indices.slice(), 1));

    const aabb_center = new Vector3(
      mesh.aabb.center.x,
      mesh.aabb.center.y,
      mesh.aabb.center.z,
    );
    const aabb_extent = new Vector3(
      mesh.aabb.extent.x,
      mesh.aabb.extent.y,
      mesh.aabb.extent.z,
    );

    const geometry = this.createSkirtMesh(
      mesh,
      buf,
      terrainGeometry,
      position,
      uv,
      indices,
    );

    geometry.boundingBox = new Box3(
      aabb_center.clone().sub(aabb_extent),
      aabb_center.clone().add(aabb_extent),
    );

    geometry.boundingSphere = new Sphere(aabb_center, aabb_extent.length());

    if (mat.showBoundingBox) {
      const bb = new Box3Helper(geometry.boundingBox, 0x00ff00);
      this.add(bb);
    }
    this.geometry = geometry;

    this.material = this.initMaterial(mat, uniforms, globe);

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
      textureFragmentIndex,
      tileMeshToFragmentIds,
    );
    this.setupTextures(loadedTexes, textureOptions, maxTextures, mat);

    // Create shadow mesh if we have separate terrain geometry (i.e., skirt exists)
    // This prevents the skirt from casting unexpected shadows
    if (geometry !== terrainGeometry) {
      terrainGeometry.boundingBox = geometry.boundingBox.clone();
      terrainGeometry.boundingSphere = geometry.boundingSphere.clone();

      // Create shadow mesh using terrain-only geometry (without skirt)
      this.shadowMesh = new Mesh(terrainGeometry, this.material);
      this.shadowMesh.castShadow = !!mat.castShadow;
      this.shadowMesh.receiveShadow = !!mat.receiveShadow;
      this.add(this.shadowMesh);

      // Main mesh with skirt doesn't cast shadow, but receives it
      this.castShadow = false;
      this.receiveShadow = !!mat.receiveShadow;
    } else {
      // No skirt - use the main mesh for both rendering and shadow
      this.castShadow = !!mat.castShadow;
      this.receiveShadow = !!mat.receiveShadow;
    }

    this.visible = false;
    this.renderOrder = mesh.render_order;
    this.userData.tileOrigColor = globe.color;
    if (transform) setTransform(this, transform);
    scenes.globe.add(this);
    meshes.set(id, this);
  }

  // Create combined geometry (terrain + skirt) for rendering.
  // Normals are computed dynamically in the fragment shader from vPosition,
  // Shadow casting is handled separately by shadowMesh (terrain-only, no skirt).
  createSkirtMesh(
    mesh: EventMesh,
    buf: BufferLoader,
    terrainGeometry: BufferGeometry,
    position: Float32Array,
    uv: Float32Array | null,
    indices: Uint32Array,
  ) {
    // Check for separate skirt data
    const skirtVerticesHandle = mesh.skirt_vertices;
    const skirtIndicesHandle = mesh.skirt_indices;
    const skirtUvsHandle = mesh.skirt_uvs;
    const skirtIndicesToEdgeHandle = mesh.skirt_indices_to_edge;

    const hasSkirt = skirtVerticesHandle != null && skirtIndicesHandle != null;
    const skirtPosition =
      skirtVerticesHandle != null ? buf.f32(skirtVerticesHandle) : null;
    const skirtIndices =
      skirtIndicesHandle != null ? buf.u32(skirtIndicesHandle) : null;
    const skirtUv = skirtUvsHandle != null ? buf.f32(skirtUvsHandle) : null;
    const skirtIndicesToEdge =
      skirtIndicesToEdgeHandle != null
        ? buf.u32(skirtIndicesToEdgeHandle)
        : null;

    // Create combined geometry (terrain + skirt) for main rendering
    let geometry: BufferGeometry;
    if (hasSkirt && skirtPosition && skirtIndices) {
      geometry = new BufferGeometry();

      // Combine vertices: terrain vertices + skirt vertices
      const combinedPosition = new Float32Array(
        position.length + (skirtPosition?.length ?? 0),
      );
      combinedPosition.set(position);
      combinedPosition.set(skirtPosition, position.length);
      geometry.setAttribute(
        "position",
        new BufferAttribute(combinedPosition, 3),
      );

      // Combine UVs
      if (uv) {
        const combinedUv = new Float32Array(uv.length + (skirtUv?.length ?? 0));
        combinedUv.set(uv);
        if (skirtUv) {
          combinedUv.set(skirtUv, uv.length);
        }
        geometry.setAttribute("uv", new BufferAttribute(combinedUv, 2));
      }

      // Combine indices: terrain indices + skirt indices
      const combinedIndices = new Uint32Array(
        indices.length + (skirtIndices?.length ?? 0),
      );
      combinedIndices.set(indices);
      combinedIndices.set(skirtIndices, indices.length);
      geometry.setIndex(new BufferAttribute(combinedIndices, 1));

      // Clean up
      skirtPosition.set([]);
      skirtIndices.set([]);
      if (skirtUv) {
        skirtUv.set([]);
      }
      if (skirtIndicesToEdge) {
        skirtIndicesToEdge.set([]);
      }
    } else {
      // No skirt data - use terrain geometry directly
      geometry = terrainGeometry;
    }

    // Clean up original buffers
    position.set([]);
    indices.set([]);
    if (uv) {
      uv.set([]);
      uv = null;
    }

    return geometry;
  }

  private initMaterial(
    _mat: RasterTileInternalMaterial,
    uniforms: CommonUniforms,
    globe: Globe,
  ): TileMaterial {
    const m = new MeshLambertMaterial({
      stencilWrite: false,
      color: globe.color,
    });

    m.userData.uPickable = {
      value: 0,
    };

    m.userData.uTime = uniforms.time;

    m.userData.defines ??= {};
    m.userData.defines.USE_UV = 1;
    m.userData.defines.USE_ELEVATION_HEATMAP = 0;
    m.userData.defines.USE_HILLSHADE = 0;

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
      shader.uniforms.uWaterNormalMap = uniforms.waterTexture;
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

      // Hillshade uniforms
      shader.uniforms.uIsHillshades = m.userData.isHillshades;
      shader.uniforms.uHillshadeRGBScaler = m.userData.hillshadeRGBScaler;
      shader.uniforms.uHillshadeBoundary = m.userData.hillshadeBoundary;
      shader.uniforms.uHillshadeMinOffset = m.userData.hillshadeMinOffset;
      shader.uniforms.uHillshadeMaxOffset = m.userData.hillshadeMaxOffset;
      shader.uniforms.uHillshadeEpsilon = m.userData.hillshadeEpsilon;
      shader.uniforms.uHillshadeOffset = m.userData.hillshadeOffset;
      shader.uniforms.uHillshadeExaggeration = m.userData.hillshadeExaggeration;
      shader.uniforms.uMetersPerTexel = m.userData.metersPerTexel;

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
  uniform bool uIsHillshades[${maxTextures}];
  uniform float uMetersPerTexel[${maxTextures}];
  uniform sampler2D uWaterNormalMap;
  uniform float uPickable;
  uniform float uIor;
  uniform float uTime;

  // Add varying for original UV coordinates
  varying vec2 vOrigUv;

  #include <common>

  // uColorMapTexture is used for elevation heatmap color mapping
  ${ElevationParsFragment}

  // Hillshade: compute normals from DEM
  ${HillshadeParsFragment}
  `,
        )
        .replace(
          "#include <lights_lambert_pars_fragment>",
          `
        #include <lights_lambert_pars_fragment>

        ${WaterParsFragment}
        ${SpecularParsFragment}
        `,
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

    #if USE_HILLSHADE
      // Skip hillshade textures for color rendering (they're only used for normals)
      if (uIsHillshades[${idx}]) {
        ${texColorVar} = vec4(0.0); // Transparent, no color contribution
      }
      else
    #endif
    #if USE_ELEVATION_HEATMAP
      // Check if this is an elevation heatmap texture
      if (uIsElevationHeatmaps[${idx}]) {
        // For elevation heatmap: decode DEM data with bilinear interpolation and apply color mapping
        ivec2 demTexSize = textureSize(uTextures[${idx}], 0);
        float normalized_h = sampleElevationBilinear(uTextures[${idx}], texUv, demTexSize);
        ${texColorVar} = vec4(texture2D(uColorMapTexture, vec2(normalized_h, 0.5)).rgb, 1.0);
      }
      else {
        ${texColorVar} = texture2D(uTextures[${idx}], texUv) * vec4(uColors[${idx}], 1.0);
      }
    #else
      {
        // For regular textures: use color as-is
        ${texColorVar} = texture2D(uTextures[${idx}], texUv) * vec4(uColors[${idx}], 1.0);
      }
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
  diffuseColor.rgb = sampledDiffuseColor.rgb;
  `,
        )
        .replace(
          "#include <normal_fragment_maps>",
          `
  vec3 N = normalize(vPosition);
  normal = normalize(mat3(viewMatrix) * N);

  ${generateHillshadeNormalShader(maxTextures)}

  vec3 origNormal = vec3(normal);
  vec3 specular = vec3(0.0);
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
  }
  `,
        )
        .replace(
          "vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;",
          `
          vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
          outgoingLight += specular;
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
        )
        .replace(
          "#include <envmap_fragment>",
          createReplacer(ShaderChunk.envmap_fragment).replace(
            "outgoingLight += envColor.xyz * specularStrength * reflectivity;",
            "outgoingLight += envColor.xyz * specularStrength * tileReflectivity;",
          ).source,
        )
        .replace(
          "outputBuffer1 = vec4(packNormalToVec2(normal), reflectivity, roughnessFactor);",
          `vec3 finalNormal = mix(origNormal, normalize(origNormal * 0.7 + normal), applyWaterNormals);
          outputBuffer1 = vec4(packNormalToVec2(finalNormal), tileReflectivity, tileRoughness);`,
        ).source;
    };

    this._viewContext?.applyShadowMaterial(m);

    return m;
  }

  _update(
    mesh: MeshChanged,
    loadedTexes: Map<string, Texture>,
    textureOptions: TextureOptions,
    tileMapByHandle: TileMapByHandle,
    textureFragmentIndex: Map<string, Set<TextureSlot>>,
    tileMeshToFragmentIds: Map<TileMesh, Set<string>>,
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
        textureFragmentIndex,
        tileMeshToFragmentIds,
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

    // Update shadow settings
    // If shadowMesh exists, it handles castShadow while main mesh only receives shadows
    if (this.shadowMesh) {
      if (this.shadowMesh.castShadow !== changedMaterial.castShadow) {
        this.shadowMesh.castShadow = !!changedMaterial.castShadow;
      }
      if (this.shadowMesh.receiveShadow !== changedMaterial.receiveShadow) {
        this.shadowMesh.receiveShadow = !!changedMaterial.receiveShadow;
      }
      // Main mesh with skirt never casts shadow
      this.castShadow = false;
    } else {
      if (this.castShadow !== changedMaterial.castShadow) {
        this.castShadow = !!changedMaterial.castShadow;
      }
    }
    if (this.receiveShadow !== changedMaterial.receiveShadow) {
      this.receiveShadow = !!changedMaterial.receiveShadow;
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
      if (mesh instanceof PolygonMesh) {
        // Use PolygonMesh getters that expose material enhancer state
        m.userData.reflectivities.value[lastIdx] = mesh.reflectivity;
        m.userData.roughnesses.value[lastIdx] = mesh.roughness;
        m.userData.waters.value[lastIdx] = mesh.water;
        m.userData.waterScaleNormals.value[lastIdx] = mesh.waterScaleNormal;
        m.userData.waterSpeeds.value[lastIdx] = mesh.waterSpeed;
        m.userData.shininesses.value[lastIdx] = mesh.shininess;
        m.userData.specularStrengths.value[lastIdx] = mesh.specularStrength;
        m.userData.applyWaterNormals.value[lastIdx] = mesh.applyWaterNormal;
        m.userData.speculars.value[lastIdx] = mesh.specular;
      }
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
        value: new Vector4(0, 0, 0, 0), // minOffset, maxOffset, epsilon, offset
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

    // Hillshade uniforms
    if (!m.userData.isHillshades) {
      m.userData.isHillshades = {
        value: [...new Array(maxTextures)].fill(false),
      };
    }
    if (!m.userData.hillshadeRGBScaler) {
      m.userData.hillshadeRGBScaler = {
        value: new Vector3(0, 0, 0),
      };
    }
    if (!m.userData.hillshadeBoundary) {
      m.userData.hillshadeBoundary = {
        value: 0.0,
      };
    }
    if (!m.userData.hillshadeMinOffset) {
      m.userData.hillshadeMinOffset = {
        value: 0.0,
      };
    }
    if (!m.userData.hillshadeMaxOffset) {
      m.userData.hillshadeMaxOffset = {
        value: 0.0,
      };
    }
    if (!m.userData.hillshadeEpsilon) {
      m.userData.hillshadeEpsilon = {
        value: 0.01,
      };
    }
    if (!m.userData.hillshadeOffset) {
      m.userData.hillshadeOffset = {
        value: 0.0,
      };
    }
    if (!m.userData.hillshadeExaggeration) {
      m.userData.hillshadeExaggeration = {
        value: 1.0,
      };
    }
    if (!m.userData.metersPerTexel) {
      m.userData.metersPerTexel = {
        value: [...new Array(maxTextures)].fill(1.0),
      };
    }

    // Reset all texture properties
    for (let i = 0; i < m.userData.shows.value.length; i++) {
      m.userData.shows.value[i] = 0;
      m.userData.colors.value[i] = new Color();
      m.userData.opacities.value[i] = 1;
      m.userData.isElevationHeatmaps.value[i] = false; // Reset elevation heatmap flags
      m.userData.isHillshades.value[i] = false; // Reset hillshade flags
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
    if (mat.isElevationHeatmaps && mat.isElevationHeatmaps.length > 0) {
      for (
        let i = 0;
        i < Math.min(mat.isElevationHeatmaps.length, maxTextures);
        i++
      ) {
        m.userData.isElevationHeatmaps.value[i] =
          mat.isElevationHeatmaps[i] !== 0;
      }
    }

    // Update hillshade parameters from Rust material
    if (mat.isHillshades && mat.isHillshades.length > 0) {
      for (let i = 0; i < Math.min(mat.isHillshades.length, maxTextures); i++) {
        m.userData.isHillshades.value[i] = mat.isHillshades[i] !== 0;
      }
    }

    // Hillshade decoder (from hillshade_config)
    m.userData.hillshadeRGBScaler.value.set(
      mat.hillshadeRScaler,
      mat.hillshadeGScaler,
      mat.hillshadeBScaler,
    );
    m.userData.hillshadeBoundary.value = mat.hillshadeBoundary;
    m.userData.hillshadeMinOffset.value = mat.hillshadeMinOffset;
    m.userData.hillshadeMaxOffset.value = mat.hillshadeMaxOffset;
    m.userData.hillshadeEpsilon.value = mat.hillshadeEpsilon;
    m.userData.hillshadeOffset.value = mat.hillshadeOffset;
    m.userData.hillshadeExaggeration.value = mat.hillshadeExaggeration;

    m.userData.elevationRGBScaler.value.set(
      mat.elevationRScaler,
      mat.elevationGScaler,
      mat.elevationBScaler,
    );

    m.userData.elevationMinMaxHeightAndBoundary.value.set(
      mat.elevationMinHeight,
      mat.elevationMaxHeight,
      mat.elevationBoundary,
    );

    m.userData.elevationMinMaxOffsetAndEpsilonAndOffset.value.set(
      mat.elevationMinOffset,
      mat.elevationMaxOffset,
      mat.elevationEpsilon,
      mat.elevationOffset,
    );

    m.userData.logarithmic.value = mat.logarithmic;
    m.userData.logBase.value = Math.log(mat.logBoundary);
    m.userData.logBoundary.value = mat.logBoundary;

    if (!m.userData.defines) {
      m.userData.defines = {
        USE_UV: 1,
        USE_ELEVATION_HEATMAP: 0,
        USE_HILLSHADE: 0,
      };
    }

    const prevHeatmap = m.userData.defines.USE_ELEVATION_HEATMAP;
    const prevHillshade = m.userData.defines.USE_HILLSHADE;

    const newHeatmap = m.userData.isElevationHeatmaps.value.some(
      (v: boolean) => v === true,
    )
      ? 1
      : 0;
    const newHillshade = m.userData.isHillshades.value.some(
      (v: boolean) => v === true,
    )
      ? 1
      : 0;

    m.userData.defines.USE_ELEVATION_HEATMAP = newHeatmap;
    m.userData.defines.USE_HILLSHADE = newHillshade;

    if (prevHeatmap !== newHeatmap || prevHillshade !== newHillshade) {
      this.material.needsUpdate = true;
    }
  }

  private setupTextureFragments(
    textureFragments: TextureFragment[] | undefined,
    tileMapByHandle: TileMapByHandle,
    readyParentTileHandle: TileHandle | undefined,
    textureFragmentIndex: Map<string, Set<TextureSlot>>,
    tileMeshToFragmentIds: Map<TileMesh, Set<string>>,
  ) {
    const m = this.material;

    if (!textureFragments || !textureFragments.length) {
      if (!readyParentTileHandle) {
        // No fragments - clear material state and remove from index
        m.userData.textureFragments = { value: [] };
        updateTextureFragmentIndex(
          textureFragmentIndex,
          tileMeshToFragmentIds,
          this,
          [],
        );
        return;
      }

      m.userData.textureFragments = tileMapByHandle.get(
        readyParentTileHandle,
      )?.material.userData.textureFragments;

      // Update index with parent's texture fragments
      const parentFragments = m.userData.textureFragments?.value ?? [];
      updateTextureFragmentIndex(
        textureFragmentIndex,
        tileMeshToFragmentIds,
        this,
        parentFragments,
      );
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

    // Update reverse index for efficient texture fragment lookups
    updateTextureFragmentIndex(
      textureFragmentIndex,
      tileMeshToFragmentIds,
      this,
      texturesFragmentIds,
    );
  }

  setupTextures(
    loadedTexes: Map<string, Texture>,
    textureOptions: TextureOptions,
    maxTextures: number,
    mat: Partial<RasterTileInternalMaterial> | RasterTileInternalMaterial,
  ) {
    const m = this.material;

    if (!m.userData.textures) {
      m.userData.textures = {
        value: [...new Array(maxTextures)].fill(null),
      };
    }

    if (!m.userData.metersPerTexel) {
      m.userData.metersPerTexel = {
        value: [...new Array(maxTextures)].fill(1.0),
      };
    }

    // Reset
    for (let i = 0; i < maxTextures; i++) {
      m.userData.textures.value[i] = null;
    }

    const textureFragments = m.userData.textureFragments?.value;
    const textureFragmentsLen = textureFragments?.length ?? 0;

    const numTexturizedVector = this.numTexturizedVector;

    if (textureFragmentsLen >= this.texturizedSceneIndexFrom) {
      console.error(
        `Exceeded maximum textures: ${textureFragmentsLen} layers are provided. Maximum the number of textures is ${this.texturizedSceneIndexFrom}.`,
      );
    }

    const textures = m.userData.textures.value;

    // Calculate tile's center latitude for metersPerTexel calculation
    const tile = this.tileHandler.getTile(this.handle);
    let cosLat = 1.0; // Default to equator if tile not found
    const EARTH_CIRCUMFERENCE = 2.0 * Math.PI * getWGS84SemiMajorAxis();

    if (tile) {
      const coords = tile.coords;
      const tileSize = 1 << coords.z;
      const centerY = (coords.y + 0.5) / tileSize;
      const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * centerY)));
      cosLat = Math.cos(latRad);
    }

    // Setting tile textures
    for (let i = 0; i < textureFragmentsLen; i++) {
      if (i >= this.texturizedSceneIndexFrom) {
        break;
      }

      const textureFragment = textureFragments[i];
      const t = textureFragment ? loadedTexes.get(textureFragment) : undefined;
      if (!t) {
        textures[i] = null;
        continue;
      }

      const isElevationHeatmap =
        mat.isElevationHeatmaps && mat.isElevationHeatmaps[i];
      const isHillshade = mat.isHillshades && mat.isHillshades[i];

      // Set hillshade parameters (zoom level and metersPerTexel)
      // Read zoom level from texture.userData (set by hillshade.ts when texture was created)
      if (isHillshade) {
        const layerZoom = t.userData.hillshadeZoom;
        if (layerZoom !== undefined) {
          const metersPerTexel =
            (EARTH_CIRCUMFERENCE * cosLat) / (256 * Math.pow(2, layerZoom));
          m.userData.metersPerTexel.value[i] = metersPerTexel;
        }
      }

      const isDEMTexture = isElevationHeatmap || isHillshade;
      const targetColorSpace = isDEMTexture ? NoColorSpace : SRGBColorSpace;

      // Update colorSpace if needed
      const colorSpaceChanged = t.colorSpace !== targetColorSpace;
      if (colorSpaceChanged) {
        t.colorSpace = targetColorSpace;
        t.needsUpdate = true;
      }

      // CRITICAL: DEM textures must use NearestFilter to prevent interpolation
      // Linear interpolation between ocean RGB(128,0,0) and land RGB(0,0,5)
      // produces intermediate values like RGB(64,0,2) which decode to ~42000m!
      // Always apply these settings for DEM textures, independent of colorSpace change
      if (isDEMTexture) {
        if (t.minFilter !== NearestFilter) {
          t.minFilter = NearestFilter;
          t.needsUpdate = true;
        }
        if (t.magFilter !== NearestFilter) {
          t.magFilter = NearestFilter;
          t.needsUpdate = true;
        }
        if (t.generateMipmaps !== false) {
          t.generateMipmaps = false;
          t.needsUpdate = true;
        }
      } else {
        // Regular textures: only update sampler settings when first binding
        if (t.minFilter !== textureOptions.minFilter) {
          t.minFilter = textureOptions.minFilter as MinificationTextureFilter;
          t.needsUpdate = true;
        }
        if (t.magFilter !== textureOptions.magFilter) {
          t.magFilter = textureOptions.magFilter as MagnificationTextureFilter;
          t.needsUpdate = true;
        }
        if (t.anisotropy !== textureOptions.maxAnisotropy) {
          t.anisotropy = textureOptions.maxAnisotropy;
          t.needsUpdate = true;
        }
        if (t.generateMipmaps !== textureOptions.useMipmaps) {
          t.generateMipmaps = textureOptions.useMipmaps;
          t.needsUpdate = true;
        }
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

  /**
   * Rebind textures for this TileMesh by calling setupTextures
   * This ensures texture updates go through the standard texture management system
   * Used by hillshade backfill and other dynamic texture updates
   */
  rebindTextures(
    loadedTexs: Map<string, Texture>,
    textureOptions: TextureOptions,
  ) {
    const material = this.material;
    if (!material || !material.userData) return;

    // Create a minimal material object with the required fields from current material
    const materialData: Partial<RasterTileInternalMaterial> = {
      isElevationHeatmaps: material.userData.isElevationHeatmaps?.value,
      isHillshades: material.userData.isHillshades?.value,
    };

    // Call setupTextures to properly bind textures through standard flow
    this.setupTextures(
      loadedTexs,
      textureOptions,
      this.maxTextures,
      materialData,
    );
  }

  _setPickable(pickable: boolean): void {
    if (pickable) {
      this.material.color.setHex(0);
    } else {
      this.material.color.setHex(this.userData.tileOrigColor);
    }
    this.material.userData.uPickable.value = pickable ? 1 : 0;
  }

  dispose(
    tileMapByHandle?: TileMapByHandle,
    textureFragmentIndex?: Map<string, Set<TextureSlot>>,
    tileMeshToFragmentIds?: Map<TileMesh, Set<string>>,
  ) {
    // Remove from texture fragment index
    if (textureFragmentIndex && tileMeshToFragmentIds) {
      removeTextureFragmentIndex(
        textureFragmentIndex,
        tileMeshToFragmentIds,
        this,
      );
    }

    this._viewContext?.removeShadowMaterial(this.material);

    // Note: geometry disposal (including shadowMesh.geometry) is handled by
    // disposeObject3D() in event/index.ts before removedFromWorld is dispatched.
    // We only need to remove shadowMesh from the scene graph here.
    if (this.shadowMesh) {
      this.remove(this.shadowMesh);
      this.shadowMesh = undefined;
    }

    // Detach any observers we attached on texturized scenes
    if (this.texturizedScenes?.userData?.childrenObserver) {
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
    for (const s of this.texturizedScenes?.children ?? []) {
      if (s.userData?.childrenObserver) {
        s.removeEventListener("childadded", s.userData.childrenObserver);
        s.removeEventListener("childremoved", s.userData.childrenObserver);
        s.userData.childrenObserver = undefined;
      }
    }

    // Dispose WebGLRenderTargets to free GPU memory
    for (const renderTarget of this.texturizedSceneRenderTargets) {
      renderTarget.dispose();
    }
    this.texturizedSceneRenderTargets.length = 0;

    // Clean up from tileMapByHandle
    if (tileMapByHandle) {
      tileMapByHandle.delete(this.handle);
    }

    // Clean up from texturizedSceneByTileCoordinates
    this.texturizedSceneByTileCoordinates.delete(this.handle);
  }
}
