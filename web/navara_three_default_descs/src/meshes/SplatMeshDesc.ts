import type ThreeView from "@navara/three";
import {
  MeshDesc,
  type MeshConfig,
  type MeshUpdate,
  type PassKey,
  type ViewContext,
} from "@navara/three";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";
import { SRGBColorSpace, Scene } from "three";

type Description = {
  splat?: {
    /** URL of the splat file (.spz, .ply, .splat, .ksplat, .pcsogs, etc.). */
    url: string;
    /**
     * Enable Level-of-Detail. `false` (default) renders every splat each
     * frame; `true` builds an in-memory LoD tree and picks splats per frame.
     */
    lod?: boolean;
  };
};

export type SplatMeshConfig = MeshConfig & Description;

export type SplatMeshUpdate = MeshUpdate & Description;

type SharedEntry = {
  renderer: SparkRenderer;
  refCount: number;
  enableLod: boolean;
  /**
   * Whatever `SparkRenderer.sparkOverride` was pointing at when we first
   * acquired (typically `undefined`, but could be a renderer owned by another
   * ThreeView). Restored when the last ref is released so we don't trash a
   * neighbouring view's override.
   */
  previousOverride: SparkRenderer | undefined;
};

const shared = new WeakMap<Scene, SharedEntry>();

/**
 * SparkRenderer is a `THREE.Mesh` that aggregates every `SplatMesh` in the
 * scene each frame. It must live in the same scene as the splats and there
 * should be exactly one per ThreeView. We share it across all `SplatMeshDesc`
 * instances via a refCount and lazy init: the first descriptor creates it,
 * the last destroys it. `SparkRenderer.sparkOverride` is a Spark-side static
 * that lets new `SplatMesh` instances find this renderer automatically.
 */
function acquireSparkRenderer(
  ctx: ViewContext,
  opts: { enableLod: boolean },
): SparkRenderer {
  // Use the transparent scene so splats render *after* the atmosphere /
  // aerial-perspective post-effects. This preserves the splat's original
  // color and crispness; atmosphere is only applied to the opaque MRT pass.
  const target = ctx.scenes.transparent;
  const existing = shared.get(target);
  if (existing) {
    if (existing.enableLod !== opts.enableLod) {
      console.warn(
        `SplatMeshDesc: SparkRenderer is already shared with enableLod=${existing.enableLod}; ignoring requested ${opts.enableLod}.`,
      );
    }
    existing.refCount += 1;
    // Another view may have overwritten sparkOverride; new SplatMesh
    // instances look it up to find their renderer.
    SparkRenderer.sparkOverride = existing.renderer;
    return existing.renderer;
  }

  // Match Spark's output color space to whatever the post-processing pipeline
  // is using internally. Navara's EffectComposer uses HalfFloatType
  // intermediate buffers (RenderPassOrchestrator.ts) which hold linear values
  // and have an empty `colorSpace` tag (NoColorSpace). The pipeline performs
  // a single sRGB encoding at the very end. So Spark must emit linear unless
  // the intermediate buffer is explicitly sRGB-tagged.
  const encodeLinear =
    ctx.getInputBuffer().texture.colorSpace !== SRGBColorSpace;

  const renderer = new SparkRenderer({
    renderer: ctx.getRenderer(),
    enableLod: opts.enableLod,
    encodeLinear,
  });
  target.add(renderer);
  // Capture whatever override was set before us so release can restore it,
  // instead of unconditionally clearing it (which would break a peer view).
  const previousOverride = SparkRenderer.sparkOverride;
  SparkRenderer.sparkOverride = renderer;

  shared.set(target, {
    renderer,
    refCount: 1,
    enableLod: opts.enableLod,
    previousOverride,
  });
  return renderer;
}

function releaseSparkRenderer(ctx: ViewContext): void {
  const target = ctx.scenes.transparent;
  const entry = shared.get(target);
  if (!entry) return;

  entry.refCount -= 1;
  if (entry.refCount > 0) return;

  target.remove(entry.renderer);
  entry.renderer.dispose();
  if (SparkRenderer.sparkOverride === entry.renderer) {
    SparkRenderer.sparkOverride = entry.previousOverride;
  }
  shared.delete(target);
}

export class SplatMeshDesc extends MeshDesc<
  SplatMeshConfig,
  SplatMeshUpdate,
  SplatMesh
> {
  private config: SplatMeshConfig;
  private incremented = false;

  constructor(view: ThreeView, ctx: ViewContext, config: SplatMeshConfig) {
    super(view, ctx, config);
    this.config = config;
  }

  protected override getPassKey(): PassKey {
    return "transparent";
  }

  createMesh(): SplatMesh {
    const cfg = this.config.splat;
    if (!cfg?.url) {
      throw new Error("SplatMeshDesc requires splat.url");
    }

    const lod = cfg.lod ?? false;
    acquireSparkRenderer(this.ctx, { enableLod: lod });

    // Reserve a Worker slot so SparkJS's sort/LoD threads aren't starved by
    // tile/GLTF loaders. Guard with canIncrement() because increment() is a
    // no-op at capacity, which would unbalance the matching decrement.
    if (this.ctx.concurrencyManager.canIncrement()) {
      this.ctx.concurrencyManager.increment();
      this.incremented = true;
    }

    const mesh = new SplatMesh({ url: cfg.url, lod });
    mesh.initialized
      .then(() => this.requestUpdate())
      .catch((err) => {
        console.warn("SplatMesh load failed:", err);
        // The splat will never produce frames, so release the worker slot
        // reserved at creation. SparkRenderer ref stays alive until onDestroy
        // so any sibling splats keep working.
        if (this.incremented) {
          this.ctx.concurrencyManager.decrement();
          this.incremented = false;
        }
      });
    return mesh;
  }

  onUpdateConfig(updates: SplatMeshUpdate): void {
    const next = updates.splat;
    const current = this.config.splat;
    const immutable: (keyof NonNullable<Description["splat"]>)[] = [
      "url",
      "lod",
    ];
    for (const key of immutable) {
      if (next?.[key] !== undefined && next[key] !== current?.[key]) {
        console.warn(
          `SplatMeshDesc: splat.${key} cannot be changed after creation; recreate the descriptor.`,
        );
      }
    }
    // Keep the stored config in sync with the latest requested values so a
    // repeated update with the same value doesn't re-warn. Note: immutable
    // fields are still effectively frozen at the rendered splat — this only
    // affects what we compare against next time.
    if (next && current) {
      Object.assign(current, next);
    }
    super.onUpdateConfig(updates);
  }

  override onDestroy(): void {
    // Capture the SplatMesh before `super.onDestroy()` runs: the base
    // implementation reads `this.raw` (= `_instance`) to remove the mesh from
    // its parent scene, then `BaseDesc.onDestroy()` clears `_instance`.
    // Disposing the mesh's GPU resources must happen AFTER the scene removal
    // but the reference would be gone — so we grab it here.
    const mesh = this._instance;
    super.onDestroy();
    mesh?.dispose();

    releaseSparkRenderer(this.ctx);
    if (this.incremented) {
      this.ctx.concurrencyManager.decrement();
      this.incremented = false;
    }
  }
}
