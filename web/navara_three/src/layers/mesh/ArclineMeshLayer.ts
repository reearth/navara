import {
  MeshLayerDeclaration,
  type MeshLayerConfig,
  ViewContext,
  type MeshLayerUpdate,
} from "../../core";
import { DefaultArcLineConfig, ArcLine, type ArcLineConfig } from "../../mesh";

type LayerDescription = {
  arcLines?: Partial<ArcLineConfig> | Partial<ArcLineConfig>[];
};

export type ArclineMeshLayerConfig = MeshLayerConfig & LayerDescription;

export type ArclineMeshLayerUpdate = MeshLayerUpdate & LayerDescription;

export class ArclineMeshLayer extends MeshLayerDeclaration<
  ArclineMeshLayerConfig,
  ArclineMeshLayerUpdate,
  ArcLine
> {
  private config: ArclineMeshLayerConfig;

  constructor(view: ViewContext, config: ArclineMeshLayerConfig) {
    super(view, config);
    this.config = config;
  }

  protected getPassKey() {
    return "mrt" as const;
  }

  createMesh() {
    const lineConfig: Partial<ArcLineConfig>[] = [];
    if (this.config.arcLines) {
      const configs = Array.isArray(this.config.arcLines)
        ? this.config.arcLines
        : [this.config.arcLines];

      for (const cfg of configs) {
        lineConfig.push({
          thickness: cfg.thickness ?? DefaultArcLineConfig.thickness,
          transparent: cfg.transparent ?? DefaultArcLineConfig.transparent,
          opacity: cfg.opacity ?? DefaultArcLineConfig.opacity,
          segments: cfg.segments ?? DefaultArcLineConfig.segments,
          srcColor: cfg.srcColor ?? DefaultArcLineConfig.srcColor,
          tgtColor: cfg.tgtColor ?? DefaultArcLineConfig.tgtColor,
          height: cfg.height ?? DefaultArcLineConfig.height,
          arcHeightScale:
            cfg.arcHeightScale ?? DefaultArcLineConfig.arcHeightScale,
          gradation: cfg.gradation ?? DefaultArcLineConfig.gradation,
          geometry: cfg.geometry ?? DefaultArcLineConfig.geometry,
        });
      }
    }

    return new ArcLine(lineConfig);
  }

  onUpdateConfig(updates: ArclineMeshLayerUpdate): void {
    if (this.config.arcLines && updates.arcLines && this._instance) {
      Object.assign(this.config.arcLines, updates.arcLines);
      const updateConfigs = Array.isArray(updates.arcLines)
        ? updates.arcLines
        : [updates.arcLines];
      this._instance.updateConfig(updateConfigs);
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
