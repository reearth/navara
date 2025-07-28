import {
  ViewContext,
  MeshLayerDeclaration,
  type MeshLayerConfig,
} from "../../core";
import { SnowMesh, type SnowConfig } from "../../mesh";

type LayerDescription = {
  snow?: Partial<SnowConfig>;
};

export type SnowMeshLayerConfig = MeshLayerConfig & LayerDescription;

export type SnowMeshLayerUpdate = Pick<
  MeshLayerConfig,
  "position" | "visible"
> &
  LayerDescription;

export class SnowMeshLayer extends MeshLayerDeclaration<
  SnowMeshLayerConfig,
  SnowMeshLayerUpdate,
  SnowMesh
> {
  private config: SnowMeshLayerConfig;

  constructor(view: ViewContext, config: SnowMeshLayerConfig) {
    super(view, config);
    this.config = config;
  }

  getPassKey(): "opaque" | "transparent" {
    return this.instance?.followCamera ? "transparent" : "opaque";
  }

  createMesh() {
    const snowConfig: Partial<SnowConfig> = this.config.snow ?? {};

    return new SnowMesh(snowConfig);
  }

  onUpdateConfig(updates: SnowMeshLayerUpdate): void {
    if (this.config.snow && updates.snow && this.instance) {
      Object.assign(this.config.snow, updates.snow);
      this.instance.updateConfig(updates.snow);
      this.emit("_needsUpdate");
    }

    super.onUpdateConfig(updates);
  }

  update(time: number): void {
    this.instance?.update(time, this.view.camera);
  }

  protected disposeMesh(): void {
    if (this.instance) {
      this.instance.dispose();
      this.instance = null;
    }
  }
}
