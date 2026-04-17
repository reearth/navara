import type ThreeView from "@navara/three";
import {
  MeshLayerDeclaration,
  PickableMeshWrapper,
  type MeshLayerConfig,
  type ViewContext,
  type MeshLayerUpdate,
} from "@navara/three";

import {
  DefaultSmoothLineConfig,
  SmoothLine,
  type SmoothLineConfig,
} from "./smoothLine";

type LayerDescription = {
  smoothLines?: Partial<SmoothLineConfig> | Partial<SmoothLineConfig>[];
};

export type SmoothLineMeshLayerConfig = MeshLayerConfig &
  LayerDescription & { pickable?: boolean };

export type SmoothLineMeshLayerUpdate = MeshLayerUpdate & LayerDescription;

export class SmoothLineMeshLayer extends MeshLayerDeclaration<
  SmoothLineMeshLayerConfig,
  SmoothLineMeshLayerUpdate,
  SmoothLine
> {
  private config: SmoothLineMeshLayerConfig;
  private pickWrapper?: PickableMeshWrapper;

  constructor(
    view: ThreeView,
    ctx: ViewContext,
    config: SmoothLineMeshLayerConfig,
  ) {
    super(view, ctx, config);
    this.config = config;
  }

  /** The batch ID assigned to this mesh when picking is enabled. */
  get batchId(): number | undefined {
    return this.pickWrapper?.batchId;
  }

  protected getPassKey() {
    return "mrt" as const;
  }

  createMesh() {
    const lineConfig: Partial<SmoothLineConfig>[] = [];
    if (this.config.smoothLines) {
      const configs = Array.isArray(this.config.smoothLines)
        ? this.config.smoothLines
        : [this.config.smoothLines];

      for (const cfg of configs) {
        lineConfig.push({
          tension: cfg.tension ?? DefaultSmoothLineConfig.tension,
          closed: cfg.closed ?? DefaultSmoothLineConfig.closed,
          segments: cfg.segments ?? DefaultSmoothLineConfig.segments,
          lineWidth: cfg.lineWidth ?? DefaultSmoothLineConfig.lineWidth,
          dashed: cfg.dashed ?? DefaultSmoothLineConfig.dashed,
          dashSize: cfg.dashSize ?? DefaultSmoothLineConfig.dashSize,
          dashOffset: cfg.dashOffset ?? DefaultSmoothLineConfig.dashOffset,
          gapSize: cfg.gapSize ?? DefaultSmoothLineConfig.gapSize,
          color: cfg.color ?? DefaultSmoothLineConfig.color,
          showPoints: cfg.showPoints ?? DefaultSmoothLineConfig.showPoints,
          pointSize: cfg.pointSize ?? DefaultSmoothLineConfig.pointSize,
          pointColor: cfg.pointColor ?? DefaultSmoothLineConfig.pointColor,
          points: cfg.points ?? [],
        });
      }
    }

    const smoothLine = new SmoothLine(lineConfig);

    if (this.config.pickable) {
      this.pickWrapper = new PickableMeshWrapper(smoothLine, this.ctx);
      this.ctx.registerPickableMesh(this.id, this.pickWrapper);
    }

    return smoothLine;
  }

  onUpdateConfig(updates: SmoothLineMeshLayerUpdate): void {
    if (this.config.smoothLines && updates.smoothLines && this._instance) {
      Object.assign(this.config.smoothLines, updates.smoothLines);
      const updateConfigs = Array.isArray(updates.smoothLines)
        ? updates.smoothLines
        : [updates.smoothLines];
      this._instance.updateConfig(updateConfigs);
      this.emit("needsUpdate");
    }

    super.onUpdateConfig(updates);
  }

  onResize(width: number, height: number): void {
    this._instance?.onResize(width, height);
  }

  protected disposeMesh(): void {
    if (this._instance) {
      this._instance.dispose();
      this._instance = undefined;
    }
  }

  override onDestroy(): void {
    if (this.pickWrapper) {
      this.ctx.unregisterPickableMesh(this.id);
      this.pickWrapper = undefined;
    }
    super.onDestroy();
  }
}
