import { generate_id_from_entity, type TileHandle } from "@navara/core";
import type {
  MeshAdded,
  Mesh as EventMesh,
  RasterTileInternalMaterial,
  Transform,
  TextureFragment,
  MeshChanged,
  Globe,
} from "@navara/engine";
import BranchFreeTernary from "@shaders/glsl/chunks/branchFreeTernary.glsl?raw";
import SpecularParsFragment from "@shaders/glsl/chunks/spucular_pars_fragment.glsl";
import WaterParsFragment from "@shaders/glsl/chunks/water_pars_fragment.glsl?raw";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  NearestFilter,
  Mesh,
  MeshLambertMaterial,
  RedFormat,
  RGBAFormat,
  SRGBColorSpace,
  Texture,
  UnsignedByteType,
  Vector2,
  Vector3,
  Vector4,
  AddOperation,
  Object3D,
  WebGLRenderTarget,
  type MagnificationTextureFilter,
  type MinificationTextureFilter,
  ShaderChunk,
  Box3,
  Box3Helper,
  Sphere,
  NoColorSpace,
  MeshBasicMaterial,
  LinearFilter,
} from "three";

import { PolygonMesh, PolylineMesh } from "..";
import { setTransform } from "../event";
import type { EventContext, TileHandler } from "../event/context";
import {
  generateTileCommonInjection,
  generateTileMapFragment,
  generateTileNormalFragmentMaps,
  TILE_EMISSIVE_EFFECT_BUFFER_REPLACEMENT,
  TILE_NORMAL_BUFFER_REPLACEMENT,
  TILE_PICK_FRAGMENT_OVERRIDE,
  TILE_VERTEX_INJECTIONS,
} from "../material";
import { deriveCompositeFeatures } from "../material/enhancer/tileComposite";
import type { CustomObject3DEventMap } from "../object3DEvent";
import type { SceneGroup, TexturizedSceneByTileCoordinates } from "../scene";
import type { TextureOptions } from "../textures";
import {
  planSlots,
  type CompositeFeatures,
  type CompositeGlobals,
  type CompositeLayer,
  type TileTextureCompositor,
} from "../tileTexture";
import type { TileMapByHandle } from "../type";
import type { CommonUniforms } from "../uniforms";
import { createReplacer } from "../utils";
import {
  type TextureSlot,
  updateTextureFragmentIndex,
  removeTextureFragmentIndex,
} from "../utils/textureFragmentIndex";

import type { PickableMesh } from "./pickableMesh";

export type TileMaterial = MeshBasicMaterial | MeshLambertMaterial;

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

  // Track previous parent state to avoid unnecessary re-cloning and re-rendering
  private prevParentState = new Map<
    string,
    {
      parentHandle: TileHandle;
      parentSceneRevision: number;
      isRendered: boolean;
    }
  >();

  // Separate mesh for shadow casting (uses terrain-only geometry without skirt)
  private shadowMesh?: Mesh<BufferGeometry, TileMaterial>;

  private texturizedSceneByTileCoordinates: TexturizedSceneByTileCoordinates;
  private compositor: TileTextureCompositor;
  // This is used to attach this scene as a texture to the tile.
  private texturizedScenes: SceneGroup;

  texturizedSceneRenderTargets: WebGLRenderTarget[] = [];

  private warnedExceededTextures = false;

  readonly ctx: EventContext;

  constructor(ctx: EventContext, mesh: MeshAdded) {
    super();
    this.ctx = ctx;

    const {
      texturizedSceneByTileCoordinates,
      tileTextureCompositor,
      textureOptions,
      tileMapByHandle,
      tileHandler,
    } = ctx;

    const handle = mesh.tile_handle;
    this.handle = handle;

    this.texturizedSceneByTileCoordinates = texturizedSceneByTileCoordinates;
    this.compositor = tileTextureCompositor;

    this.texturizedScenes = texturizedSceneByTileCoordinates.get(handle);

    // Acquire the per-tile composite atlas from the compositor. Pairing the
    // acquire with the mesh keeps the atlas lifecycle tied to the tile and lets
    // the compositor allocate its private OrthographicCamera for this handle.
    // The atlas Textures are bound to the main shader later in initMaterial.
    this.compositor.acquire(handle);

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
    const tileStates = this.tileHandler.getVectorTileStates(this.handle) ?? [];
    const newTileStates: NonNullable<typeof this.tileStates> = [];
    const newParentState: typeof this.prevParentState = new Map();

    let changed = false;

    for (const state of tileStates) {
      const parentHandle = state.ready_parent_tile_handle;
      const layerId = state.layer_id;

      if (parentHandle == null) continue;

      newTileStates.push({
        parentHandle,
        layerId,
        isRendered: state.is_rendered,
      });

      const parentScene =
        this.texturizedSceneByTileCoordinates.findSceneByLayerId(
          parentHandle,
          layerId,
        );
      if (!parentScene) continue;

      const parentSceneRevision = parentScene.revision;
      const prev = this.prevParentState.get(layerId);

      // Re-clone when parent changed or parent scene content changed
      if (
        !prev ||
        prev.parentHandle !== parentHandle ||
        prev.parentSceneRevision !== parentSceneRevision
      ) {
        this.texturizedSceneByTileCoordinates.addFromParentScene(
          this.handle,
          layerId,
          parentScene,
        );
        changed = true;
      }

      // isRendered flip changes visibility (parent fallback <-> own mesh)
      if (prev && prev.isRendered !== state.is_rendered) {
        changed = true;
      }

      newParentState.set(layerId, {
        parentHandle,
        parentSceneRevision,
        isRendered: state.is_rendered,
      });
    }

    // Detect removed layers
    if (this.prevParentState.size !== newParentState.size) {
      changed = true;
    }

    if (changed || (this.tileStates?.length ?? 0) !== newTileStates.length) {
      this.texturizedSceneByTileCoordinates.setNeedsUpdate(this.handle, true);
    }

    this.tileStates = newTileStates;
    this.prevParentState = newParentState;
  }

  private _onBeforeRender = () => {
    if (!this.visible) return;

    // Refresh parent-tile fallback state. Done every frame because Rust's
    // tile-state can flip between frames as data arrives.
    this.updateTexturizedSceneByTileState();

    // Warn once when more MVT layers requested than we have slots for.
    const numScenes = this.texturizedScenes.tileScenes.length;
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

    // Per-layer vector-scene offscreen render. Returns true when any render
    // happened — in that case the composite atlas needs to repaint so the
    // main shader sees the new texturized-layer pixels.
    const vectorRendered = this.compositor.renderVectorScenes(
      this.handle,
      this.texturizedSceneRenderTargets,
      (layerId) => {
        const s = this.tileStates?.find((x) => x.layerId === layerId);
        if (!s) return undefined;
        return {
          candidateParent: s.parentHandle,
          isRendered: s.isRendered,
        };
      },
      (layerId, visible) =>
        this.updateTexturizedSceneTextureVisibility(visible, layerId),
    );
    if (vectorRendered) {
      this.compositor.markDirty(this.handle, "vector-revision");
    }

    // MRT composite pass: bakes N source textures into the per-tile atlas.
    // Skip building the layer snapshot entirely when nothing is dirty.
    if (!this.compositor.cache.isDirty(this.handle)) return;
    const { layers, globals } = this.buildCompositeLayers();
    const plan = planSlots(
      layers,
      this.texturizedSceneIndexFrom,
      this.maxTextures,
    );
    this.compositor.runCompositePassIfDirty(
      this.handle,
      plan,
      globals,
      deriveCompositeFeatures(layers, globals),
    );
  };

  /**
   * Feature flags for the **main** TileMesh shader (atlas-sampling side): drives
   * its program cache key and which normal/specular branches compile. Sourced
   * from the material defines/userData, independent of the composite pass's own
   * (layer-derived) feature set — see {@link deriveCompositeFeatures}.
   */
  private computeFeatures(): CompositeFeatures {
    const ud = this.material.userData;
    return {
      hasHillshade: ud.defines?.USE_HILLSHADE === 1,
      hasWater: !!(ud.waters?.value as boolean[] | undefined)?.some(
        (v) => v === true,
      ),
      hasElevationHeatmap: !!(
        ud.isElevationHeatmaps?.value as boolean[] | undefined
      )?.some((v) => v === true),
      hasWatermask: this.userData.watermask != null,
    };
  }

  /**
   * Snapshot the current per-slot uniform state into a typed layer list for the
   * compositor's MRT pass. Reads directly from material.userData (the same
   * source of truth the main shader uses); only slots that are both shown and
   * textured become layers, so the SlotPlanner's compact counts cover exactly
   * the active slots.
   */
  private buildCompositeLayers(): {
    layers: CompositeLayer[];
    globals: CompositeGlobals;
  } {
    const ud = this.material.userData;
    const shows: number[] = ud.shows?.value ?? [];
    const textures: (Texture | null)[] = ud.textures?.value ?? [];
    const colors: Color[] = ud.colors?.value ?? [];
    const opacities: number[] = ud.opacities?.value ?? [];
    const layerUvOffset: Vector2[] = ud.layerUvOffset?.value ?? [];
    const layerUvScale: Vector2[] = ud.layerUvScale?.value ?? [];
    const isHillshades: boolean[] = ud.isHillshades?.value ?? [];
    const isElevationHeatmaps: boolean[] = ud.isElevationHeatmaps?.value ?? [];
    const waters: boolean[] = ud.waters?.value ?? [];
    const boundary = this.texturizedSceneIndexFrom;

    const layers: CompositeLayer[] = [];
    for (let absSlot = 0; absSlot < this.maxTextures; absSlot++) {
      const texture = textures[absSlot] ?? null;
      if (shows[absSlot] !== 1 || texture == null) continue;

      const region = absSlot < boundary ? "raster" : "vector";
      const uvOffset = layerUvOffset[absSlot] ?? new Vector2(0, 0);
      const uvScale = layerUvScale[absSlot] ?? new Vector2(1, 1);

      // Hillshade takes precedence: a slot flagged both ways has its color
      // zeroed and emits a normal, so classifying it as hillshade is correct —
      // the elevation sample would be zeroed anyway.
      if (isHillshades[absSlot]) {
        layers.push({
          kind: "hillshade",
          region,
          absSlot,
          texture,
          uvOffset,
          uvScale,
        });
      } else if (isElevationHeatmaps[absSlot]) {
        layers.push({
          kind: "elevationHeatmap",
          region,
          absSlot,
          texture,
          uvOffset,
          uvScale,
          opacity: opacities[absSlot] ?? 1,
        });
      } else {
        layers.push({
          kind: "raster",
          region,
          absSlot,
          texture,
          uvOffset,
          uvScale,
          color: colors[absSlot] ?? new Color(),
          opacity: opacities[absSlot] ?? 1,
          water: waters[absSlot] ?? false,
        });
      }
    }

    const globals: CompositeGlobals = {
      hillshadeExaggeration: ud.hillshadeExaggeration?.value ?? 1,
      watermask: this.userData.watermask?.texture ?? null,
      colorMapTexture: this.ctx.uniforms.colorMapTexture.value ?? null,
      elevationRGBScaler: ud.elevationRGBScaler?.value ?? new Vector3(),
      elevationMinMaxHeightAndBoundary:
        ud.elevationMinMaxHeightAndBoundary?.value ?? new Vector3(),
      elevationMinMaxOffsetAndEpsilonAndOffset:
        ud.elevationMinMaxOffsetAndEpsilonAndOffset?.value ?? new Vector4(),
      logarithmic: ud.logarithmic?.value ?? false,
      logBase: ud.logBase?.value ?? 10,
      logBoundary: ud.logBoundary?.value ?? 10,
    };

    return { layers, globals };
  }

  async _init(mesh: MeshAdded) {
    await this.createMesh(
      generate_id_from_entity(mesh),
      mesh.mesh,
      mesh.material,
      mesh.transform,
      mesh.globe,
    );

    this.addEventListener("removedFromWorld", () => {
      this.dispose(
        this.ctx.tileMapByHandle,
        this.ctx.textureFragmentIndex,
        this.ctx.tileMeshToFragmentIds,
      );
    });
  }

  private async createMesh(
    id: string,
    mesh: EventMesh,
    mat: RasterTileInternalMaterial,
    transform: Transform | undefined,
    globe: Globe,
  ) {
    const {
      scenes,
      meshes,
      buf,
      loadedTexs,
      textureOptions,
      uniforms,
      textureFragmentIndex,
      tileMeshToFragmentIds,
    } = this.ctx;
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

    const normals = mesh.normals != null ? buf.f32(mesh.normals) : null;
    if (normals) {
      terrainGeometry.setAttribute(
        "normal",
        new BufferAttribute(normals.slice(), 3),
      );
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
      terrainGeometry,
      position,
      uv,
      indices,
      normals,
    );

    // Watermask: 1 byte = uniform, 65536 bytes = 256x256 grid. Stored for downstream consumers.
    if (mesh.watermask != null) {
      const watermask = buf.u8(mesh.watermask);
      if (watermask) {
        const isUniform = watermask.length === 1;
        const size = isUniform ? 1 : 256;
        // Single-channel R8 — the composite shader only reads `.r`. RedFormat
        // halves GPU memory vs. RGBA (256×256 = 64KB instead of 256KB).
        const texture = new DataTexture(
          watermask.slice(),
          size,
          size,
          RedFormat,
          UnsignedByteType,
        );
        texture.flipY = true;
        texture.needsUpdate = true;
        this.userData.watermask = {
          data: watermask.slice(),
          isUniform,
          texture,
        };
      }
    }

    this.userData.hasNormalAttribute = normals != null;

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

    const maxTextures = this.maxTextures;
    this.setUniforms(mat, maxTextures);
    this.setupTextureFragments(
      mat.texture_fragments(),
      textureFragmentIndex,
      tileMeshToFragmentIds,
    );
    this.setupTextures(loadedTexs, textureOptions, maxTextures, mat);

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
    if (transform) setTransform(this, transform);
    scenes.globe.add(this);
    meshes.set(id, this);
  }

  // Create combined geometry (terrain + skirt) for rendering.
  // Normals are computed dynamically in the fragment shader from vPosition,
  // Shadow casting is handled separately by shadowMesh (terrain-only, no skirt).
  createSkirtMesh(
    mesh: EventMesh,
    terrainGeometry: BufferGeometry,
    position: Float32Array,
    uv: Float32Array | null,
    indices: Uint32Array,
    normals: Float32Array | null,
  ) {
    const { buf } = this.ctx;
    // Check for separate skirt data
    const skirtVerticesHandle = mesh.skirt_vertices;
    const skirtIndicesHandle = mesh.skirt_indices;
    const skirtUvsHandle = mesh.skirt_uvs;
    const skirtIndicesToEdgeHandle = mesh.skirt_indices_to_edge;
    const skirtNormalsHandle = mesh.skirt_normals;

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
    const skirtNormals =
      skirtNormalsHandle != null ? buf.f32(skirtNormalsHandle) : null;

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

      // Combine normals: terrain normals + skirt normals (computed in Rust as edge normals)
      if (normals) {
        const combinedNormals = new Float32Array(
          normals.length + (skirtNormals?.length ?? 0),
        );
        combinedNormals.set(normals);
        if (skirtNormals) {
          combinedNormals.set(skirtNormals, normals.length);
        }
        geometry.setAttribute(
          "normal",
          new BufferAttribute(combinedNormals, 3),
        );
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
      if (skirtNormals) {
        skirtNormals.set([]);
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
    if (normals) {
      normals.set([]);
    }

    return geometry;
  }

  private shouldUseNormal(
    mat: Partial<RasterTileInternalMaterial> | RasterTileInternalMaterial,
    globe: Globe,
  ): boolean {
    // Lambert (normal-based) shading is needed if any of these is true:
    // 1. globe.useNormal is set
    // 2. a per-vertex normal attribute is bound (e.g. quantized-mesh)
    // 3. any hillshade slot is active
    const hillshadeActive = !!mat.isHillshades?.some((v) => v !== 0);
    return (
      !!globe.useNormal || !!this.userData.hasNormalAttribute || hillshadeActive
    );
  }

  private initMaterial(
    _mat: RasterTileInternalMaterial,
    uniforms: CommonUniforms,
    globe: Globe,
  ): TileMaterial {
    const useNormal = this.shouldUseNormal(_mat, globe);
    const m = useNormal
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

    m.userData.uTime = uniforms.time;

    m.userData.defines = {
      USE_UV: 1,
      USE_SELECTIVE_EFFECT: 1,
      USE_VERTEX_NORMAL: this.userData.hasNormalAttribute ? 1 : 0,
    };

    m.envMap = uniforms.tSkyEnvMap.value ?? null;
    m.combine = AddOperation;

    const maxTextures = this.maxTextures;

    // Bind the compositor's atlas outputs as TileMesh-visible uniforms so the
    // slim shader can sample them. Atlas Textures are created once per tile
    // and persist across composite passes — `needsUpdate` is flipped by the
    // compositor when a new pass writes to them.
    const atlasOutputs = this.compositor.acquireOutputs(this.handle);
    m.userData.uColorAtlas = { value: atlasOutputs.color };
    m.userData.uAttrAtlas = { value: atlasOutputs.attr };
    m.userData.uNormalAtlas = { value: atlasOutputs.normal };

    m.customProgramCacheKey = () =>
      "TILE" + JSON.stringify(this.computeFeatures());

    m.onBeforeCompile = (shader) => {
      shader.defines ??= {};
      Object.assign(shader.defines, m.userData.defines);
      shader.uniforms.reflectivity = { value: 0 };

      const features = this.computeFeatures();

      shader.uniforms.uPickable = m.userData.uPickable;
      shader.uniforms.uColorAtlas = m.userData.uColorAtlas;
      shader.uniforms.uAttrAtlas = m.userData.uAttrAtlas;
      shader.uniforms.uNormalAtlas = m.userData.uNormalAtlas;

      // Per-slot uniform arrays — indexed once per fragment by the winning
      // slot decoded from attr.a (no per-fragment loop any more).
      shader.uniforms.uColors = m.userData.colors;
      shader.uniforms.uReflectivities = m.userData.reflectivities;
      shader.uniforms.uRoughnesses = m.userData.roughnesses;
      shader.uniforms.uWaterScaleNormals = m.userData.waterScaleNormals;
      shader.uniforms.uWaterSpeeds = m.userData.waterSpeeds;
      shader.uniforms.uShininesses = m.userData.shininesses;
      shader.uniforms.uSpecularStrengths = m.userData.specularStrengths;
      shader.uniforms.uApplyWaterNormals = m.userData.applyWaterNormals;
      shader.uniforms.uSpeculars = m.userData.speculars;
      shader.uniforms.uEmissiveIntensities = m.userData.emissiveIntensities;
      shader.uniforms.uEmissiveColors = m.userData.emissiveColors;
      shader.uniforms.uEffectIdsMasks = m.userData.effectIdsMasks;
      // Satisfy MRT-injected single uniform declarations (tile uses per-slot
      // arrays + winIdx indexing instead).
      shader.uniforms.uEffectIdsMask = { value: 0 };
      shader.uniforms.uEmissiveIntensity = { value: 0 };
      shader.uniforms.uWaterNormalMap = uniforms.waterTexture;
      shader.uniforms.uHillshadeExaggeration = m.userData.hillshadeExaggeration;
      shader.uniforms.uIor = { value: 1.33333 };
      shader.uniforms.uTime = m.userData.uTime;

      shader.vertexShader = createReplacer(shader.vertexShader)
        .replace(
          "#include <common>",
          `${TILE_VERTEX_INJECTIONS.afterCommon}
#include <common>`,
        )
        .replace(
          "#include <uv_vertex>",
          `#include <uv_vertex>
          ${TILE_VERTEX_INJECTIONS.afterUvVertex}`,
        )
        .replace(
          "#include <envmap_vertex>",
          `#include <envmap_vertex>
          ${TILE_VERTEX_INJECTIONS.afterEnvmapVertex}`,
        ).source;

      shader.fragmentShader = createReplacer(shader.fragmentShader)
        .replace(
          "#include <common>",
          `
${generateTileCommonInjection(maxTextures)}

  #include <common>
  `,
        )
        .replaceWithCondition(
          "#include <lights_lambert_pars_fragment>",
          `
        #include <lights_lambert_pars_fragment>

        ${WaterParsFragment}
        ${SpecularParsFragment}
        ${BranchFreeTernary}
        `,
          useNormal,
        )
        .replace("#include <map_fragment>", generateTileMapFragment())
        .replaceWithCondition(
          "#include <normal_fragment_maps>",
          generateTileNormalFragmentMaps(features),
          useNormal,
        )
        .replaceWithCondition(
          "vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;",
          `
          vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
          outgoingLight += specular;
        `,
          useNormal,
        )
        .replaceWithCondition(
          "#include <envmap_fragment>",
          createReplacer(ShaderChunk.envmap_fragment).replace(
            "outgoingLight += envColor.xyz * specularStrength * reflectivity;",
            "outgoingLight += nvr_branchFreeTernary(useSpecular, vec3(0.0), envColor.xyz * specularStrength * tileReflectivity);",
          ).source,
          useNormal,
        )
        // Pick override is the LAST write of the fragment shader (after
        // tonemapping/colorspace/fog/dithering), so the encoded batchId
        // reaches the pick buffer bit-for-bit. See TILE_PICK_FRAGMENT_OVERRIDE.
        .replace(
          "#include <dithering_fragment>",
          `#include <dithering_fragment>
          ${TILE_PICK_FRAGMENT_OVERRIDE}`,
        )
        .replaceWithCondition(
          "normalBuffer = vec4(packNormalToVec2(normal), reflectivity, roughnessFactor);",
          TILE_NORMAL_BUFFER_REPLACEMENT,
          useNormal,
        )
        .replace(
          `effectIdBuffer = vec4(uEffectIdsMask, 0.0, 0.0, 1.0);
              emissiveBuffer = vec4(diffuseColor.rgb * uEmissiveIntensity + emissive, 1.0);`,
          TILE_EMISSIVE_EFFECT_BUFFER_REPLACEMENT,
        ).source;
    };

    this.ctx.viewContext?.applyShadowMaterial(m);

    return m;
  }

  _update(mesh: MeshChanged) {
    const {
      loadedTexs,
      textureOptions,
      textureFragmentIndex,
      tileMeshToFragmentIds,
    } = this.ctx;
    const globe = mesh.globe;
    const changedMaterial = mesh.material;
    const tileMesh = mesh.mesh;
    const active = tileMesh.active;

    const maxTextures = textureOptions.maxTextures;

    // TODO: Support hide entire globe.
    this.visible = active;

    if (active) {
      this.ensureCorrectMaterialType(changedMaterial, globe);

      this.setupTextureFragments(
        changedMaterial?.texture_fragments(),
        textureFragmentIndex,
        tileMeshToFragmentIds,
      );

      // Set uniforms (this may switch material type for hillshade)
      this.setUniforms(changedMaterial, maxTextures);

      this.setupTextures(
        loadedTexs,
        textureOptions,
        maxTextures,
        changedMaterial,
      );

      this._setupSceneObserver();

      this.texturizedSceneByTileCoordinates.setNeedsUpdate(this.handle, true);
      // Material / texture-binding changed → composite atlas must repaint.
      this.compositor.markDirty(this.handle, "material");
      this.compositor.markDirty(this.handle, "texture-binding");
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
    if (this.texturizedScenes.childrenObserver) {
      this.texturizedScenes.removeEventListener(
        "childadded",
        this.texturizedScenes.childrenObserver,
      );
      this.texturizedScenes.removeEventListener(
        "childremoved",
        this.texturizedScenes.childrenObserver,
      );
      this.texturizedScenes.childrenObserver = undefined;
    }

    const parentObserver = () => {
      for (const texturizedScene of this.texturizedScenes.tileScenes) {
        if (texturizedScene.childrenObserver) {
          texturizedScene.removeEventListener(
            "childadded",
            texturizedScene.childrenObserver,
          );
          texturizedScene.removeEventListener(
            "childremoved",
            texturizedScene.childrenObserver,
          );
          texturizedScene.childrenObserver = undefined;
        }

        const observer = () => {
          if (texturizedScene.children.length === 0) {
            this.updateTexturizedSceneTextureVisibility(
              false,
              texturizedScene.layerId,
            );
          } else {
            this.updateTexturizedSceneTextureVisibility(
              true,
              texturizedScene.layerId,
            );
          }
          this.texturizedSceneByTileCoordinates.setNeedsUpdate(
            this.handle,
            true,
          );
          // A vector layer scene changed → composite atlas must repaint.
          this.compositor.markDirty(this.handle, "vector-revision");
        };

        texturizedScene.childrenObserver = observer;

        texturizedScene.addEventListener("childadded", observer);
        texturizedScene.addEventListener("childremoved", observer);
      }
    };

    this.texturizedScenes.childrenObserver = parentObserver;

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

    const sceneIdx = this.texturizedScenes.tileScenes.findIndex(
      (c) => c.layerId === layerId,
    );
    if (sceneIdx === -1) return;

    // Look for RenderTarget's texture to change visibility.
    const lastIdx = this.texturizedSceneIndexFrom + sceneIdx;
    if (textures[lastIdx]) {
      m.userData.shows.value[lastIdx] = visible ? 1 : 0;

      const mesh = this.texturizedScenes.tileScenes[sceneIdx].children[0];
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
        m.userData.emissiveIntensities.value[lastIdx] = mesh.emissiveIntensity;
        m.userData.emissiveColors.value[lastIdx].set(mesh.emissiveColor);
        m.userData.effectIdsMasks.value[lastIdx] = mesh.effectIdsMask;
      } else if (mesh instanceof PolylineMesh) {
        m.userData.emissiveIntensities.value[lastIdx] = mesh.emissiveIntensity;
        m.userData.emissiveColors.value[lastIdx].set(mesh.emissiveColor);
        m.userData.effectIdsMasks.value[lastIdx] = mesh.effectIdsMask;
      }
    }
  }

  /**
   * Ensures the material type matches the hillshade requirements.
   * Switches between MeshBasicMaterial and MeshLambertMaterial as needed.
   * - MeshLambertMaterial: Required for hillshade (supports normal-based lighting)
   * - MeshBasicMaterial: Used when no hillshade (more performant)
   */
  private ensureCorrectMaterialType(
    mat: RasterTileInternalMaterial,
    globe: Globe,
  ): void {
    // Same decision used by initMaterial — keeping them in sync avoids
    // mid-session Lambert↔Basic flips that strip normal shading from some tiles.
    const needsLambert = this.shouldUseNormal(mat, globe);
    const isLambert = this.material instanceof MeshLambertMaterial;

    if (needsLambert !== isLambert) {
      const oldMaterial = this.material;

      // Create new material with correct type. Per-layer UV uniforms will be
      // re-populated by setupTextures before the next render.
      this.material = this.initMaterial(mat, this.ctx.uniforms, globe);

      if (this.shadowMesh) {
        this.shadowMesh.material = this.material;
      }

      // Dispose old material
      this.ctx.viewContext?.removeShadowMaterial(oldMaterial);
      oldMaterial.dispose();
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
    if (!m.userData.emissiveIntensities) {
      m.userData.emissiveIntensities = {
        value: [...new Array(maxTextures)].fill(0),
      };
    }
    if (!m.userData.emissiveColors) {
      m.userData.emissiveColors = {
        value: [...new Array(maxTextures)].map(() => new Color()),
      };
    }
    if (!m.userData.effectIdsMasks) {
      m.userData.effectIdsMasks = {
        value: [...new Array(maxTextures)].fill(0),
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

    // Hillshade exaggeration (applied during normal map sampling in shader)
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

    const prevHillshade = m.userData.defines.USE_HILLSHADE;
    const newHillshade = m.userData.isHillshades.value.some(
      (v: boolean) => v === true,
    )
      ? 1
      : 0;
    m.userData.defines.USE_HILLSHADE = newHillshade;
    if (prevHillshade !== newHillshade) {
      this.material.needsUpdate = true;
    }
  }

  private setupTextureFragments(
    textureFragments: TextureFragment[] | undefined,
    textureFragmentIndex: Map<string, Set<TextureSlot>> | undefined,
    tileMeshToFragmentIds: Map<TileMesh, Set<string>> | undefined,
  ) {
    const m = this.material;

    // Per-layer parent fallback is now resolved in Rust: when a layer's own data
    // isn't ready, the entity slot in `texture_fragments` already points at the
    // nearest ready ancestor entity for that layer. So this side has nothing to do
    // for the "no fragments / use parent" case.
    if (!textureFragments || !textureFragments.length) {
      m.userData.textureFragments = { value: [] };
      updateTextureFragmentIndex(
        textureFragmentIndex,
        tileMeshToFragmentIds,
        this,
        [],
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
    preserveLayerUv = false,
  ) {
    const m = this.material;

    if (!m.userData.textures) {
      m.userData.textures = {
        value: [...new Array(maxTextures)].fill(null),
      };
    }

    if (!m.userData.layerUvOffset) {
      m.userData.layerUvOffset = {
        value: [...new Array(maxTextures)].map(() => new Vector2(0, 0)),
      };
    }

    if (!m.userData.layerUvScale) {
      m.userData.layerUvScale = {
        value: [...new Array(maxTextures)].map(() => new Vector2(1, 1)),
      };
    }

    // Reset textures (always) and per-layer UV (only if not preserving)
    for (let i = 0; i < maxTextures; i++) {
      m.userData.textures.value[i] = null;

      // Skip resetting per-layer UV if preserving (e.g., during rebind)
      if (!preserveLayerUv) {
        m.userData.layerUvOffset.value[i].set(0, 0);
        m.userData.layerUvScale.value[i].set(1, 1);
      }
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

    // Per-layer UV transforms from Rust (covers regular textures and hillshades).
    // `null` entry means identity (no parent reuse).
    const layerUvTransforms = mat.layerUvTransforms?.() ?? [];

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

      // Per-layer UV transform: identity by default; uses Rust's resolved transform
      // when this layer is sampling a parent tile.
      if (!preserveLayerUv) {
        const uvTransform = layerUvTransforms[i];
        if (uvTransform) {
          m.userData.layerUvOffset.value[i].set(
            uvTransform.offset.x,
            uvTransform.offset.y,
          );
          m.userData.layerUvScale.value[i].set(
            uvTransform.scale.x,
            uvTransform.scale.y,
          );
        } else {
          m.userData.layerUvOffset.value[i].set(0, 0);
          m.userData.layerUvScale.value[i].set(1, 1);
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

      // CRITICAL: Elevation DEM textures must use NearestFilter to prevent interpolation artifacts.
      // Linear interpolation between ocean RGB(128,0,0) and land RGB(0,0,5)
      // produces intermediate values like RGB(64,0,2) which decode to ~42000m!
      // However, hillshade normal maps (which store normals directly in RGB, not encoded heights)
      // should use LinearFilter for smooth bilinear interpolation at tile boundaries.
      // Always apply these settings for DEM textures, independent of colorSpace change
      if (isDEMTexture) {
        if (isHillshade) {
          // Hillshade normal maps: use LinearFilter for hardware bilinear interpolation
          // Normals are stored directly in RGB [-1,1] -> [0,1], so linear filtering is safe
          if (t.minFilter !== LinearFilter) {
            t.minFilter = LinearFilter;
            t.needsUpdate = true;
          }
          if (t.magFilter !== LinearFilter) {
            t.magFilter = LinearFilter;
            t.needsUpdate = true;
          }
        }

        if (isElevationHeatmap) {
          // Elevation DEM textures: use NearestFilter to prevent decoding artifacts
          // RGB-encoded heights must not be interpolated before decoding
          if (t.minFilter !== NearestFilter) {
            t.minFilter = NearestFilter;
            t.needsUpdate = true;
          }
          if (t.magFilter !== NearestFilter) {
            t.magFilter = NearestFilter;
            t.needsUpdate = true;
          }
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
        (this.texturizedScenes.tileScenes[i]?.children.length ?? 0 > 0) ? 1 : 0;
      m.userData.colors.value[lastIndex] = new Color(0xffffff);
      m.userData.opacities.value[lastIndex] = 1.0;
    }
  }

  /**
   * Rebind textures for this TileMesh by calling setupTextures
   * This ensures texture updates go through the standard texture management system
   * Used by hillshade backfill and other dynamic texture updates.
   * Preserves existing per-layer UV transforms to avoid overwriting parent-reuse values.
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

    this.setupTextures(
      loadedTexs,
      textureOptions,
      this.maxTextures,
      materialData,
      true, // preserveLayerUv
    );
    // Hillshade backfill / dynamic rebinds change the composite atlas inputs.
    this.compositor.markDirty(this.handle, "hillshade");
  }

  onBeforePicking(): void {
    this.material.userData.uPickable.value = 1;

    this.texturizedSceneByTileCoordinates.setNeedsUpdate(this.handle, true);
    this.compositor.markDirty(this.handle, "vector-revision");
  }

  onAfterPicking(): void {
    this.material.userData.uPickable.value = 0;
    this.texturizedSceneByTileCoordinates.setNeedsUpdate(this.handle, true);
    this.compositor.markDirty(this.handle, "vector-revision");
  }

  getRenderable(): Object3D {
    return this;
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

    this.ctx.viewContext?.removeShadowMaterial(this.material);

    // Note: geometry disposal (including shadowMesh.geometry) is handled by
    // disposeObject3D() in event/index.ts before removedFromWorld is dispatched.
    // We only need to remove shadowMesh from the scene graph here.
    if (this.shadowMesh) {
      this.remove(this.shadowMesh);
      this.shadowMesh = undefined;
    }

    // Detach any observers we attached on texturized scenes
    if (this.texturizedScenes?.childrenObserver) {
      this.texturizedScenes.removeEventListener(
        "childadded",
        this.texturizedScenes.childrenObserver,
      );
      this.texturizedScenes.removeEventListener(
        "childremoved",
        this.texturizedScenes.childrenObserver,
      );
      this.texturizedScenes.childrenObserver = undefined;
    }
    for (const s of this.texturizedScenes?.tileScenes ?? []) {
      if (s.childrenObserver) {
        s.removeEventListener("childadded", s.childrenObserver);
        s.removeEventListener("childremoved", s.childrenObserver);
        s.childrenObserver = undefined;
      }
    }

    // Dispose WebGLRenderTargets to free GPU memory
    for (const renderTarget of this.texturizedSceneRenderTargets) {
      renderTarget.dispose();
    }
    this.texturizedSceneRenderTargets.length = 0;

    // Release the watermask DataTexture (one per tile, RedFormat 1×1 or 256×256).
    this.userData.watermask?.texture?.dispose();

    // Clean up from tileMapByHandle
    if (tileMapByHandle) {
      tileMapByHandle.delete(this.handle);
    }

    // Release the per-tile composite atlas (refcounted via the compositor's
    // TileTextureCache). Mirrors the acquire() in the constructor.
    this.compositor.release(this.handle);

    // Clean up from texturizedSceneByTileCoordinates
    this.texturizedSceneByTileCoordinates.delete(this.handle);
  }
}
