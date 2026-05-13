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
  /** sparkOverride snapshot from first acquire; restored on final release. */
  previousOverride: SparkRenderer | undefined;
};

const shared = new WeakMap<Scene, SharedEntry>();

/**
 * Lazily creates a single shared `SparkRenderer` per scene, ref-counted so
 * the last `SplatMeshDesc` to release also disposes it. `SparkRenderer` is a
 * `THREE.Mesh` that aggregates every `SplatMesh` in the scene each frame and
 * must live in the scene to function. `SparkRenderer.sparkOverride` is a
 * Spark-side static that lets new `SplatMesh` instances find this renderer.
 */
function acquireSparkRenderer(
  ctx: ViewContext,
  opts: { enableLod: boolean },
): SparkRenderer {
  // transparent scene renders after atmosphere/aerial-perspective post-effects,
  // preserving the splat's baked color.
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

  // Spark must emit linear when the post-pp pipeline targets are linear,
  // otherwise the final sRGB pass double-encodes.
  const encodeLinear =
    ctx.getInputBuffer().texture.colorSpace !== SRGBColorSpace;

  const renderer = new SparkRenderer({
    renderer: ctx.getRenderer(),
    enableLod: opts.enableLod,
    encodeLinear,
  });
  target.add(renderer);
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

function warnIfChanged<T>(field: string, next: T, current: T): void {
  if (next !== undefined && next !== current) {
    console.warn(
      `SplatMeshDesc: splat.${field} cannot be changed after creation; recreate the descriptor.`,
    );
  }
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
      .catch((err: unknown) => {
        console.warn("SplatMesh load failed:", err);
        // Free the Worker slot now — a failed splat won't run sort/LoD. The
        // SparkRenderer ref stays alive until onDestroy so siblings keep
        // working.
        this.releaseWorkerSlot();
      });
    return mesh;
  }

  onUpdateConfig(updates: SplatMeshUpdate): void {
    const next = updates.splat;
    const current = this.config.splat;
    warnIfChanged("url", next?.url, current?.url);
    warnIfChanged("lod", next?.lod, current?.lod);
    // Sync so a repeated update with the same value doesn't re-warn. The
    // rendered splat stays frozen at construction values regardless.
    if (next && current) {
      Object.assign(current, next);
    }
    super.onUpdateConfig(updates);
  }

  override onDestroy(): void {
    // super removes from scene then nulls _instance; capture the ref so we
    // can dispose the splat after the scene removal.
    const mesh = this._instance;
    super.onDestroy();
    mesh?.dispose();

    releaseSparkRenderer(this.ctx);
    this.releaseWorkerSlot();
  }

  private releaseWorkerSlot(): void {
    if (this.incremented) {
      this.ctx.concurrencyManager.decrement();
      this.incremented = false;
    }
  }
}
