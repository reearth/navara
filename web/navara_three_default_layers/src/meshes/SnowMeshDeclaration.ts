import {
  ViewContext,
  MeshDeclaration,
  type MeshConfig,
  type MeshUpdate,
} from "@navara/three";

import { SnowMesh, type SnowConfig } from "./snow";

type LayerDescription = {
  snow?: Partial<SnowConfig>;
};

export type SnowMeshConfig = MeshConfig & LayerDescription;

export type SnowMeshUpdate = MeshUpdate & LayerDescription;

export class SnowMeshDeclaration extends MeshDeclaration<
  SnowMeshConfig,
  SnowMeshUpdate,
  SnowMesh
> {
  private config: SnowMeshConfig;

  constructor(view: ViewContext, config: SnowMeshConfig) {
    super(view, config);
    this.config = config;
  }

  getPassKey(): "opaque" | "transparent" {
    return this._instance?.followCamera ? "transparent" : "opaque";
  }

  createMesh() {
    const snowConfig: Partial<SnowConfig> = this.config.snow ?? {};

    return new SnowMesh(snowConfig);
  }

  onUpdateConfig(updates: SnowMeshUpdate): void {
    if (this.config.snow && updates.snow && this._instance) {
      Object.assign(this.config.snow, updates.snow);
      this._instance.updateConfig(updates.snow);
      this.emit("needsUpdate");
    }

    super.onUpdateConfig(updates);
  }

  update(time: number): void {
    this._instance?.update(time, this.view.camera);
  }

  protected disposeMesh(): void {
    if (this._instance) {
      this._instance.dispose();
      this._instance = undefined;
    }
  }
}
