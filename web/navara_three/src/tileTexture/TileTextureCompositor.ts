import { type TileHandle } from "@navara/core";
import { orthoCameraTransform } from "@navara/engine";
import {
  Color,
  DataTexture,
  GLSL3,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  type Texture,
  UnsignedByteType,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";

import {
  buildCompositeFragmentShader,
  composeCompositeContributions,
  compositeFeatureKey,
  COMPOSITE_VERTEX_SHADER,
  createCoreUniformMutates,
  createCompositeLayerEnhancers,
  type CompositeLayerEnhancer,
  type CompositeUniformTarget,
  type CoreUniformMutates,
} from "../material/enhancer/tileComposite";
import {
  type SceneGroup,
  type TexturizedSceneByTileCoordinates,
} from "../scene";

import type { SlotPlan } from "./SlotPlanner";
import { TileTextureCache } from "./TileTextureCache";
import type {
  AtlasFactory,
  CompositeAtlas,
  CompositeFeatures,
  CompositeGlobals,
  CompositeOutputs,
  DirtyReason,
} from "./types";

const PREV_CLEAR_COLOR = new Color();

/**
 * Default atlas factory: a single MRT WebGLRenderTarget (count=3) sized
 * `size × size` with RGBA8 textures. All three attachments share format —
 * three.js's MRT API doesn't allow per-attachment formats — so we trade some
 * attr-channel precision for one draw call to populate color/attr/normal.
 */
export const defaultAtlasFactory =
  (renderer: WebGLRenderer | null): AtlasFactory =>
  (size: number): CompositeAtlas => {
    void renderer;
    const target = new WebGLRenderTarget(size, size, {
      count: 3,
      format: RGBAFormat,
      type: UnsignedByteType,
      depthBuffer: false,
      stencilBuffer: false,
    });
    const [color, attr, normal] = target.textures;
    return {
      target,
      color,
      attr,
      normal,
      dispose: () => target.dispose(),
    };
  };

export type TileTextureCompositorOptions = {
  renderer: WebGLRenderer;
  texturizedSceneByTileCoordinates: TexturizedSceneByTileCoordinates;
  /** Atlas RT side length. Plan fixes this at 512. */
  size?: number;
  /** Test seam: replace MRT RT creation. */
  atlasFactory?: AtlasFactory;
};

type CachedMaterial = {
  material: ShaderMaterial;
  /** Number of compact slots (rasterCount + vectorCount). */
  numTextures: number;
  /** Owns the core per-slot uniforms (shows/colors/opacities/textures/uv). */
  core: CoreUniformMutates;
  /** Active composite layer enhancers — each owns its own uniforms. */
  chain: CompositeLayerEnhancer[];
  /** 1×1 fallback so unbound texture array slots stay valid samplers. */
  placeholderTexture: Texture;
};

/**
 * Integration layer for per-tile texture composition.
 *
 * Responsibilities:
 * - Owns the per-tile composite atlas via TileTextureCache.
 * - Runs the per-layer vector-scene offscreen render (ported wholesale from
 *   the previous TileMesh._onBeforeRender so behaviour is unchanged).
 * - Runs the MRT composite pass that bakes N source textures (raster + vector
 *   + hillshade) into the atlas (color + attr + normal). The TileMesh main
 *   shader then samples each atlas attachment once instead of looping over N
 *   slots per fragment.
 * - Tracks dirty handles so the composite pass only runs when something
 *   actually changes (tile add, layer update, hillshade backfill, vector
 *   revision bump, …).
 */
export class TileTextureCompositor {
  readonly renderer: WebGLRenderer;
  readonly cache: TileTextureCache;
  private readonly texturizedScenes: TexturizedSceneByTileCoordinates;
  private readonly cameraByHandle = new Map<TileHandle, OrthographicCamera>();

  // Composite-pass machinery (lazily created on first use so tests that
  // don't render don't pay the allocation).
  private readonly quadScene = new Scene();
  private readonly quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quadMesh: Mesh;
  private readonly materialCache = new Map<string, CachedMaterial>();

  constructor(opts: TileTextureCompositorOptions) {
    this.renderer = opts.renderer;
    this.texturizedScenes = opts.texturizedSceneByTileCoordinates;
    this.cache = new TileTextureCache({
      size: opts.size ?? 512,
      atlasFactory: opts.atlasFactory ?? defaultAtlasFactory(opts.renderer),
    });

    // Single shared fullscreen quad — material is swapped per render.
    this.quadMesh = new Mesh(new PlaneGeometry(2, 2));
    this.quadScene.add(this.quadMesh);
    this.quadCamera.position.z = 1;
  }

  // ---------------------------------------------------------------------
  // Cache-facing API
  // ---------------------------------------------------------------------

  acquire(handle: TileHandle): CompositeOutputs {
    if (!this.cameraByHandle.has(handle)) {
      const c = new OrthographicCamera();
      c.copy(this.texturizedScenes.camera);
      this.cameraByHandle.set(handle, c);
    }
    return this.cache.acquire(handle);
  }

  release(handle: TileHandle): void {
    this.cache.release(handle);
    this.cameraByHandle.delete(handle);
  }

  /** Refcount-neutral accessor for an already-acquired handle's atlas. */
  acquireOutputs(handle: TileHandle): CompositeOutputs {
    const out = this.cache.getOutputs(handle);
    if (!out) {
      throw new Error(
        `TileTextureCompositor: handle not acquired before requesting outputs`,
      );
    }
    return out;
  }

  markDirty(handle: TileHandle, reason: DirtyReason): void {
    this.cache.markDirty(handle, reason);
  }

  // ---------------------------------------------------------------------
  // Vector-scene render (ported from TileMesh._onBeforeRender)
  // ---------------------------------------------------------------------

  getSceneGroup(handle: TileHandle): SceneGroup {
    return this.texturizedScenes.get(handle);
  }

  /**
   * Render each per-layer texturized scene into its dedicated RT. The caller
   * still owns the per-layer RT array; rendering loop + parent-tile camera
   * adjustment + renderer state save/restore are ported verbatim from the
   * previous TileMesh._onBeforeRender to preserve behaviour.
   *
   * Returns true when any render happened; TileMesh uses that to flag the
   * composite atlas dirty.
   */
  renderVectorScenes(
    handle: TileHandle,
    renderTargets: WebGLRenderTarget[],
    layerStateResolver: (
      layerId: string,
    ) =>
      | { candidateParent: TileHandle | undefined; isRendered: boolean }
      | undefined,
    onSceneVisibility: (layerId: string, visible: boolean) => void,
  ): boolean {
    const sceneGroup = this.texturizedScenes.get(handle);
    if (!this.texturizedScenes.getNeedsUpdate(handle)) return false;
    this.texturizedScenes.setNeedsUpdate(handle, false);

    const camera =
      this.cameraByHandle.get(handle) ??
      (() => {
        const c = new OrthographicCamera();
        c.copy(this.texturizedScenes.camera);
        this.cameraByHandle.set(handle, c);
        return c;
      })();

    let rendered = false;
    let i = -1;
    for (const tileScene of sceneGroup.tileScenes) {
      i++;
      if (tileScene.removed || !tileScene.children.length) {
        onSceneVisibility(tileScene.layerId, false);
        continue;
      }
      onSceneVisibility(tileScene.layerId, true);

      const renderTarget = renderTargets[i];
      if (!renderTarget) break;

      const prevTarget = this.renderer.getRenderTarget();
      const prevClear = this.renderer.getClearColor(PREV_CLEAR_COLOR);

      const layerId = tileScene.layerId;
      const state = layerStateResolver(layerId);
      const noOwnMesh = !this.texturizedScenes.hasCurrentMesh(handle, layerId);
      const parentHandle =
        state && (!state.isRendered || noOwnMesh)
          ? state.candidateParent
          : undefined;

      this.texturizedScenes.showMeshFromParent(handle, layerId, !!parentHandle);

      const originalLeft = camera.left;
      const originalRight = camera.right;
      const originalTop = camera.top;
      const originalBottom = camera.bottom;

      if (parentHandle) {
        const r = orthoCameraTransform(handle, parentHandle);
        camera.left = r.left;
        camera.right = r.right;
        camera.top = r.top;
        camera.bottom = r.bottom;
        camera.updateProjectionMatrix();
      }

      this.renderer.setRenderTarget(renderTarget);
      this.renderer.setClearColor(0x000, 0);
      this.renderer.clear();
      this.renderer.render(tileScene, camera);

      if (parentHandle) {
        camera.left = originalLeft;
        camera.right = originalRight;
        camera.top = originalTop;
        camera.bottom = originalBottom;
        camera.updateProjectionMatrix();
      }

      this.renderer.setRenderTarget(prevTarget);
      this.renderer.setClearColor(prevClear, 1);
      renderTarget.texture.needsUpdate = true;
      rendered = true;
    }
    return rendered;
  }

  // ---------------------------------------------------------------------
  // MRT composite pass
  // ---------------------------------------------------------------------

  /**
   * Run the composite MRT pass for a handle if (and only if) its atlas is
   * dirty. Consumes the dirty flags on success so the next frame skips work
   * unless something marks it dirty again.
   *
   * The pass writes:
   *   color  attachment  = alpha-composited diffuse over N slots
   *   attr   attachment  = water + texturized-layer flags + winning slot idx
   *   normal attachment  = hillshade normal (or neutral)
   *
   * Returns true when a render happened.
   */
  runCompositePassIfDirty(
    handle: TileHandle,
    plan: SlotPlan,
    globals: CompositeGlobals,
    features: CompositeFeatures,
  ): boolean {
    if (!this.cache.isDirty(handle)) return false;
    const entry = this.cache.getEntry(handle);
    if (!entry) return false;

    const prevTarget = this.renderer.getRenderTarget();
    const prevClear = this.renderer.getClearColor(PREV_CLEAR_COLOR);

    // No active slots → either clear (nothing to bake) or fall through to the
    // shader path when a slot-independent feature still needs to write the
    // atlas. Currently that's watermask only: it samples a per-tile texture
    // and bakes the result into attr.r so water reflection works on tiles
    // that have no raster/vector layers (e.g. open-ocean quantized-mesh).
    const noSlots = plan.rasterCount + plan.vectorCount === 0;
    if (noSlots && !features.hasWatermask) {
      this.renderer.setRenderTarget(entry.atlas.target);
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.clear();
      this.renderer.setRenderTarget(prevTarget);
      this.renderer.setClearColor(prevClear, 1);
      entry.atlas.color.needsUpdate = true;
      entry.atlas.attr.needsUpdate = true;
      entry.atlas.normal.needsUpdate = true;
      this.cache.consumeDirty(handle);
      return true;
    }

    const mat = this.getOrCreateMaterial(plan, features);

    this.bindUniforms(mat, plan, globals);
    this.quadMesh.material = mat.material;

    this.renderer.setRenderTarget(entry.atlas.target);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear();
    this.renderer.render(this.quadScene, this.quadCamera);

    this.renderer.setRenderTarget(prevTarget);
    this.renderer.setClearColor(prevClear, 1);

    entry.atlas.color.needsUpdate = true;
    entry.atlas.attr.needsUpdate = true;
    entry.atlas.normal.needsUpdate = true;

    this.cache.consumeDirty(handle);
    return true;
  }

  private getOrCreateMaterial(
    plan: SlotPlan,
    features: CompositeFeatures,
  ): CachedMaterial {
    const { rasterCount, vectorCount, boundary } = plan;
    const numTextures = rasterCount + vectorCount;
    const key = `${rasterCount}|${vectorCount}|${boundary}|${compositeFeatureKey(features)}`;
    const cached = this.materialCache.get(key);
    if (cached) return cached;

    // 1×1 transparent placeholder. A bare `new Texture()` has no image and
    // triggers a "Texture marked for update but no image data found" warning
    // when three.js tries to upload it.
    const placeholderTexture = new DataTexture(
      new Uint8Array([0, 0, 0, 0]),
      1,
      1,
      RGBAFormat,
      UnsignedByteType,
    );
    placeholderTexture.needsUpdate = true;

    // Build the enhancer chain once and use it for both shader generation and
    // uniform ownership: each active enhancer attaches its own uniform refs and
    // contributes the matching GLSL, so a new expression touches only its module.
    const chain = createCompositeLayerEnhancers(features);
    const core = createCoreUniformMutates();

    const uniforms: CompositeUniformTarget = {};
    core.attachUniforms(uniforms, numTextures, placeholderTexture);
    let defines: Record<string, number> = {};
    for (const enhancer of chain) {
      enhancer.attachUniforms?.(uniforms, numTextures, placeholderTexture);
      if (enhancer.defines) defines = { ...defines, ...enhancer.defines };
    }

    const material = new ShaderMaterial({
      glslVersion: GLSL3,
      defines,
      uniforms,
      vertexShader: COMPOSITE_VERTEX_SHADER,
      fragmentShader: buildCompositeFragmentShader(
        rasterCount,
        vectorCount,
        boundary,
        composeCompositeContributions(chain, numTextures),
      ),
      depthTest: false,
      depthWrite: false,
    });

    const entry: CachedMaterial = {
      material,
      numTextures,
      core,
      chain,
      placeholderTexture,
    };
    this.materialCache.set(key, entry);
    return entry;
  }

  private bindUniforms(
    mat: CachedMaterial,
    plan: SlotPlan,
    globals: CompositeGlobals,
  ): void {
    // Single pass over the compact slots: the base binds the core uniforms and
    // each active enhancer fills its own per-slot ref for the same slot.
    for (let k = 0; k < mat.numTextures; k++) {
      const layer = plan.slots[k]?.layer;
      mat.core.bindSlot(k, layer);
      for (const enhancer of mat.chain) enhancer.bindSlot?.(k, layer);
    }
    for (const enhancer of mat.chain) enhancer.bindGlobal?.(globals);
  }

  // ---------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------

  dispose(): void {
    this.cache.disposeAll();
    this.cameraByHandle.clear();
    for (const m of this.materialCache.values()) {
      m.material.dispose();
      m.placeholderTexture.dispose();
    }
    this.materialCache.clear();
    this.quadMesh.geometry.dispose();
  }
}
