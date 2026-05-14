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

type SplatDescription = {
  splat?: {
    url: string;
    lod?: boolean;
  };
};

export type SplatMeshConfig = MeshConfig & SplatDescription;

export type SplatMeshUpdate = MeshUpdate & SplatDescription;

type SharedEntry = {
  renderer: SparkRenderer;
  refCount: number;
  enableLod: boolean;
};

const shared = new WeakMap<Scene, SharedEntry>();

function acquireSparkRenderer(
  ctx: ViewContext,
  opts: { enableLod: boolean },
): { renderer: SparkRenderer; enableLod: boolean } {
  // Transparent scene: render after atmosphere/aerial-perspective so baked color survives.
  const target = ctx.scenes.transparent;
  const existing = shared.get(target);
  if (existing) {
    // Only the lod:true → lod:false downgrade wastes memory; the reverse is fine.
    if (opts.enableLod && !existing.enableLod) {
      console.warn(
        `SplatMeshDesc: splat.lod=true requested but the shared SparkRenderer was created with splat.lod=false; rendering this mesh without LoD.`,
      );
    }
    existing.refCount += 1;
    // Re-assert in case another view clobbered the global.
    SparkRenderer.sparkOverride = existing.renderer;
    return { renderer: existing.renderer, enableLod: existing.enableLod };
  }

  // Linear when the post-pp pipeline is linear, else the final sRGB pass double-encodes.
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
  return { renderer, enableLod: opts.enableLod };
}

function releaseSparkRenderer(ctx: ViewContext): void {
  const target = ctx.scenes.transparent;
  const entry = shared.get(target);
  if (!entry) return;

  entry.refCount -= 1;
  if (entry.refCount > 0) return;

  target.remove(entry.renderer);
  entry.renderer.dispose();
  // Clear (not restore): a saved override could outlive its renderer.
  if (SparkRenderer.sparkOverride === entry.renderer) {
    SparkRenderer.sparkOverride = undefined;
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
  private holdsSlot = false;

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

    const requestedLod = cfg.lod ?? false;
    const { enableLod: rendererLod } = acquireSparkRenderer(this.ctx, {
      enableLod: requestedLod,
    });
    const effectiveLod = requestedLod && rendererLod;

    // Slot held only during load; released on `mesh.initialized` settle.
    if (this.ctx.concurrencyManager.canIncrement()) {
      this.ctx.concurrencyManager.increment();
      this.holdsSlot = true;
    }

    const mesh = new SplatMesh({ url: cfg.url, lod: effectiveLod });
    mesh.initialized
      .then(() => this.requestUpdate())
      .catch((err: unknown) => {
        console.warn("SplatMesh load failed:", err);
      })
      .finally(() => this.releaseSlot());
    return mesh;
  }

  private releaseSlot(): void {
    if (this.holdsSlot) {
      this.ctx.concurrencyManager.decrement();
      this.holdsSlot = false;
    }
  }

  onUpdateConfig(updates: SplatMeshUpdate): void {
    const next = updates.splat;
    const current = this.config.splat;
    warnIfChanged("url", next?.url, current?.url);
    // Normalize both sides to avoid an undefined vs false false-warn.
    warnIfChanged("lod", next?.lod ?? false, current?.lod ?? false);
    // Field-by-field so an undefined doesn't overwrite the resolved value.
    if (next && current) {
      if (next.url !== undefined) current.url = next.url;
      if (next.lod !== undefined) current.lod = next.lod;
    }
    super.onUpdateConfig(updates);
  }

  override onDestroy(): void {
    // Capture before super: super removes from scene and nulls `_instance`.
    const mesh = this._instance;
    super.onDestroy();
    mesh?.dispose();

    // Fallback: destroyed before `mesh.initialized` settled.
    this.releaseSlot();
    releaseSparkRenderer(this.ctx);
  }
}
