import {
  MeshDeclaration,
  type MeshConfig,
  type ViewContext,
} from "@navara/three";
import { AxesHelper } from "three";

type LayerDescription = {
  axesHelper?: {
    size?: number;
  };
};

export type AxesHelperConfig = MeshConfig & LayerDescription;

export type AxesHelperUpdate = Pick<
  MeshConfig,
  "position" | "visible"
> &
  LayerDescription;

export class AxesHelperDeclaration extends MeshDeclaration<
  AxesHelperConfig,
  AxesHelperUpdate,
  AxesHelper
> {
  private config: AxesHelperConfig;

  constructor(view: ViewContext, config: AxesHelperConfig) {
    super(view, config);
    this.config = config;
  }

  createMesh(): AxesHelper {
    const size = this.config.axesHelper?.size ?? 5;

    const axesHelper = new AxesHelper(size);

    return axesHelper;
  }

  onUpdateConfig(updates: AxesHelperUpdate): void {
    if (updates.axesHelper && this._instance) {
      if (updates.axesHelper.size !== undefined) {
        // AxesHelper doesn't support dynamic size updates, would need to recreate
        this.recreate();
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
