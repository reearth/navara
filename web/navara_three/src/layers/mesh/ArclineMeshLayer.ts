import {
  MeshLayerDeclaration,
  type MeshLayerConfig,
  ViewContext,
  type MeshLayerUpdate,
} from "../../core";
import { DefaultArcLineConfig, ArcLine, type ArcLineConfig } from "../../mesh";

type LayerDescription = {
  arcLine?: Partial<ArcLineConfig>;
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

  createMesh() {
    const lineConfig: Partial<ArcLineConfig> = {
      thickness:
        this.config.arcLine?.thickness ?? DefaultArcLineConfig.thickness,
      opacity: this.config.arcLine?.opacity ?? DefaultArcLineConfig.opacity,
      segments: this.config.arcLine?.segments ?? DefaultArcLineConfig.segments,
      srcColor: this.config.arcLine?.srcColor ?? DefaultArcLineConfig.srcColor,
      tgtColor: this.config.arcLine?.tgtColor ?? DefaultArcLineConfig.tgtColor,
      height: this.config.arcLine?.height ?? DefaultArcLineConfig.height,
      geometry: this.config.arcLine?.geometry ?? DefaultArcLineConfig.geometry,
    };

    return new ArcLine(lineConfig);
  }

  onUpdateConfig(updates: ArclineMeshLayerUpdate): void {
    if (this.config.arcLine && updates.arcLine && this._instance) {
      Object.assign(this.config.arcLine, updates.arcLine);
      this._instance.updateConfig(updates.arcLine);
      this.emit("_needsUpdate");
    }

    super.onUpdateConfig(updates);
  }

  onResize(width: number, height: number): void {
    this._instance?.onResize(width, height);
  }

  protected disposeMesh(): void {
    if (this._instance) {
      this._instance.geometry.dispose();
      this._instance.material.dispose();

      this._instance = undefined;
    }
  }
}
