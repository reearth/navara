import { type TileHandle } from "@navara/core";
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
import { type TexturizedSceneByTileCoordinates } from "../scene";

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
  /** Atlas RT side length (defaults to 512). */
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
  // Single fixed [-1, 1] camera shared by every vector-scene bake. Ancestor
  // fallback is resolved in Rust, so no per-tile camera transform is needed.
  private readonly vectorCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // Composite-pass machinery (lazily created on first use so tests that
  // don't render don't pay the allocation).
  private readonly quadScene = new Scene();
  private readonly quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quadMesh: Mesh;
  private readonly materialCache = new Map<string, CachedMaterial>();
  // Vector render targets this compositor has ever rendered to. three.js
  // allocates a render target's GL framebuffer on first setRenderTarget, so
  // an empty slot whose target was never touched must be skipped entirely —
  // clearing it would allocate size² × 4 bytes of GPU memory for nothing.
  private readonly touchedVectorTargets = new WeakSet<WebGLRenderTarget>();

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
    this.vectorCamera.position.z = 1;
  }

  // ---------------------------------------------------------------------
  // Cache-facing API
  // ---------------------------------------------------------------------

  acquire(handle: TileHandle): CompositeOutputs {
    return this.cache.acquire(handle);
  }

  release(handle: TileHandle): void {
    this.cache.release(handle);
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
  // Vector-scene render
  // ---------------------------------------------------------------------

  /**
   * Bake each resolved vector layer's WM source scenes into its per-layer render
   * target (slot `i` → `renderTargets[i]`). A layer can be backed by several WM
   * vector tiles when the terrain is Geographic (N:M); every source is drawn into
   * the one render target, each framed by the Rust-supplied mercator affine
   * `uvOffset`/`uvScale` so it lands in its sub-rect. Since the affine maps the
   * terrain tile's `[0, 1]` UV into the source frame, the render-target UV ends up
   * equal to the terrain UV — i.e. the RT spans the terrain tile's extent, ready
   * for the composite paste's latitude reprojection. `(0,0)/(1,1)` (an exact
   * same-tile drape, WebMercator terrain) maps a single source to the full RT.
   *
   * The render target is cleared once, then each source is drawn additively
   * (autoClear off) so the sources mosaic instead of overwriting one another. A
   * source whose scene hasn't reached the cache yet is skipped; its sub-rect stays
   * transparent until it arrives (no flashing — coarser ancestors back the gaps
   * via the Rust scene-ready walk-up). The caller owns the dirty gate and only
   * calls this when the resolved slots or scenes change.
   */
  renderVectorScenes(
    slots: {
      layerId: string;
      sources: {
        tileHandle: TileHandle;
        uvOffset: [number, number];
        uvScale: [number, number];
      }[];
    }[],
    renderTargets: WebGLRenderTarget[],
  ): void {
    const camera = this.vectorCamera;
    const prevTarget = this.renderer.getRenderTarget();
    const prevClear = this.renderer.getClearColor(PREV_CLEAR_COLOR);
    const prevClearAlpha = this.renderer.getClearAlpha();
    const prevAutoClear = this.renderer.autoClear;
    // Accumulate multiple sources into one RT: clear once, never per render.
    this.renderer.autoClear = false;

    for (let i = 0; i < renderTargets.length; i++) {
      const renderTarget = renderTargets[i];
      if (!renderTarget) continue;

      const slot = slots[i];
      // An empty slot only needs a clear when the target holds stale content
      // from a previous bake; a never-touched target has no GL storage yet
      // and must not be render-targeted (that would allocate it).
      if (!slot && !this.touchedVectorTargets.has(renderTarget)) continue;
      this.touchedVectorTargets.add(renderTarget);

      this.renderer.setRenderTarget(renderTarget);
      this.renderer.setClearColor(0x000, 0);
      this.renderer.clear();

      if (slot) {
        for (const source of slot.sources) {
          const scene = this.texturizedScenes.findSceneByLayerId(
            source.tileHandle,
            slot.layerId,
          );
          if (!scene || scene.removed || !scene.children.length) continue;
          // Frame the terrain tile's sub-rect of this source tile from the
          // mercator uvOffset/uvScale: meshUv ∈ [0,1] → vectorUv = uvOffset +
          // meshUv·uvScale, source scene NDC = 2·vectorUv − 1. A source finer than
          // the terrain tile yields a camera wider than [-1, 1], so it draws into
          // only its sub-rect and leaves the rest of the RT transparent.
          const [ox, oy] = source.uvOffset;
          const [sx, sy] = source.uvScale;
          camera.left = 2 * ox - 1;
          camera.right = 2 * (ox + sx) - 1;
          camera.bottom = 2 * oy - 1;
          camera.top = 2 * (oy + sy) - 1;
          camera.updateProjectionMatrix();
          this.renderer.render(scene, camera);
        }
      }

      renderTarget.texture.needsUpdate = true;
    }

    this.renderer.autoClear = prevAutoClear;
    this.renderer.setRenderTarget(prevTarget);
    this.renderer.setClearColor(prevClear, prevClearAlpha);
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
    const prevClearAlpha = this.renderer.getClearAlpha();

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
      this.renderer.setClearColor(prevClear, prevClearAlpha);
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
    this.renderer.setClearColor(prevClear, prevClearAlpha);

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
    for (const m of this.materialCache.values()) {
      m.material.dispose();
      m.placeholderTexture.dispose();
    }
    this.materialCache.clear();
    this.quadMesh.geometry.dispose();
  }
}
