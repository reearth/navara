import {
  MeshLayerDeclaration,
  type MeshLayerConfig,
  ViewContext,
  type MeshLayerUpdate,
} from "../../core";
import {
  DefaultSmoothLineConfig,
  SmoothLine,
  type SmoothLineConfig,
} from "../../mesh";

type LayerDescription = {
  smoothLines?: Partial<SmoothLineConfig>[];
};

export type SmoothLineMeshLayerConfig = MeshLayerConfig & LayerDescription;

export type SmoothLineMeshLayerUpdate = MeshLayerUpdate & LayerDescription;

export class SmoothLineMeshLayer extends MeshLayerDeclaration<
  SmoothLineMeshLayerConfig,
  SmoothLineMeshLayerUpdate,
  SmoothLine
> {
  private config: SmoothLineMeshLayerConfig;

  constructor(view: ViewContext, config: SmoothLineMeshLayerConfig) {
    super(view, config);
    this.config = config;
  }

  protected getPassKey() {
    return "mrt" as const;
  }

  createMesh() {
    const lineConfig: Partial<SmoothLineConfig>[] = [];
    if (this.config.smoothLines) {
      for (const cfg of this.config.smoothLines) {
        lineConfig.push({
          tension: cfg.tension ?? DefaultSmoothLineConfig.tension,
          closed: cfg.closed ?? DefaultSmoothLineConfig.closed,
          segments: cfg.segments ?? DefaultSmoothLineConfig.segments,
          lineWidth: cfg.lineWidth ?? DefaultSmoothLineConfig.lineWidth,
          dashed: cfg.dashed ?? DefaultSmoothLineConfig.dashed,
          dashSize: cfg.dashSize ?? DefaultSmoothLineConfig.dashSize,
          gapSize: cfg.gapSize ?? DefaultSmoothLineConfig.gapSize,
          color: cfg.color ?? DefaultSmoothLineConfig.color,
          showPoints: cfg.showPoints ?? DefaultSmoothLineConfig.showPoints,
          pointSize: cfg.pointSize ?? DefaultSmoothLineConfig.pointSize,
          pointColor: cfg.pointColor ?? DefaultSmoothLineConfig.pointColor,
          points: cfg.points ?? [],
        });
      }
    }

    return new SmoothLine(lineConfig);
  }

  onUpdateConfig(updates: SmoothLineMeshLayerUpdate): void {
    if (this.config.smoothLines && updates.smoothLines && this._instance) {
      Object.assign(this.config.smoothLines, updates.smoothLines);
      this._instance.updateConfig(updates.smoothLines);
      this.emit("_needsUpdate");
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
}
