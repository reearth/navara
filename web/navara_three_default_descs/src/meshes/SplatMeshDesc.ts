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
    /** Enable SparkJS Level-of-Detail. Set at creation time only. */
    lod?: boolean;
  };
};

export type SplatMeshConfig = MeshConfig & Description;

export type SplatMeshUpdate = MeshUpdate & Description;

type SharedEntry = {
  renderer: SparkRenderer;
  refCount: number;
  enableLod: boolean;
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
  SparkRenderer.sparkOverride = renderer;

  shared.set(target, {
    renderer,
    refCount: 1,
    enableLod: opts.enableLod,
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
    SparkRenderer.sparkOverride = undefined;
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

    // SparkJS uses a small worker pool internally for sorting and LoD. Reserve
    // a slot in Navara's ConcurrencyManager so other consumers (tile/GLTF
    // loaders, etc.) avoid contending for those threads while a splat is alive.
    this.ctx.concurrencyManager.increment();
    this.incremented = true;

    const mesh = new SplatMesh({ url: cfg.url, lod });
    mesh.initialized
      .then(() => this.requestUpdate())
      .catch((err) => {
        console.warn("SplatMesh load failed:", err);
      });
    return mesh;
  }

  onUpdateConfig(updates: SplatMeshUpdate): void {
    const next = updates.splat;
    const current = this.config.splat;
    if (next?.url !== undefined && next.url !== current?.url) {
      console.warn(
        "SplatMeshDesc: splat.url cannot be changed after creation; recreate the descriptor.",
      );
    }
    if (next?.lod !== undefined && next.lod !== current?.lod) {
      console.warn(
        "SplatMeshDesc: splat.lod cannot be changed after creation; recreate the descriptor.",
      );
    }
    super.onUpdateConfig(updates);
  }

  protected disposeMesh(): void {
    if (this._instance) {
      this._instance.dispose();
      this._instance = undefined;
    }
  }

  override onDestroy(): void {
    this.disposeMesh();
    releaseSparkRenderer(this.ctx);
    if (this.incremented) {
      this.ctx.concurrencyManager.decrement();
      this.incremented = false;
    }
    super.onDestroy();
  }
}
