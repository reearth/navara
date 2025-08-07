import { AxesHelper } from "three";

import {
  MeshLayerDeclaration,
  type MeshLayerConfig,
  type ViewContext,
} from "../../core";

type LayerDescription = {
  axesHelper?: {
    size?: number;
    scale?: number;
  };
};

export type AxesHelperLayerConfig = MeshLayerConfig & LayerDescription;

export type AxesHelperLayerUpdate = Pick<
  MeshLayerConfig,
  "position" | "visible"
> &
  LayerDescription;

export class AxesHelperLayer extends MeshLayerDeclaration<
  AxesHelperLayerConfig,
  AxesHelperLayerUpdate,
  AxesHelper
> {
  private config: AxesHelperLayerConfig;

  constructor(view: ViewContext, config: AxesHelperLayerConfig) {
    super(view, config);
    this.config = config;
  }

  createMesh(): AxesHelper {
    const size = this.config.axesHelper?.size ?? 5;
    const scale = this.config.axesHelper?.scale ?? 1e9;

    const axesHelper = new AxesHelper(size);
    axesHelper.scale.multiplyScalar(scale);

    return axesHelper;
  }

  onUpdateConfig(updates: AxesHelperLayerUpdate): void {
    if (updates.axesHelper && this._instance) {
      if (updates.axesHelper.size !== undefined) {
        // AxesHelper doesn't support dynamic size updates, would need to recreate
        this.recreate();
      }
      if (updates.axesHelper.scale !== undefined) {
        this._instance.scale.setScalar(updates.axesHelper.scale);
        this.emit("_needsUpdate");
      }
    }

    super.onUpdateConfig(updates);
  }

  private recreate(): void {
    if (this._instance) {
      this.onDestroy();
      this.onCreate();
    }
  }

  protected disposeMesh(): void {
    if (this._instance) {
      this._instance.dispose();
      this._instance = undefined;
    }
  }
}
