import {
  EffectDeclaration,
  type EffectConfig,
  type EffectUpdate,
  type ViewContext,
} from "@navara/three";

import { DepthOfField, type DepthOfFieldOptions } from "./depthOfField";

type LayerDescription = {
  depthOfField?: Omit<DepthOfFieldOptions, "enabled">;
};

export type DepthOfFieldConfig = LayerDescription & EffectConfig;

export type DepthOfFieldUpdate = LayerDescription & EffectUpdate;

export class DepthOfFieldEffectDeclaration extends EffectDeclaration<
  DepthOfFieldConfig,
  DepthOfFieldUpdate,
  DepthOfField
> {
  static key = "depthOfField";
  static insertAfter = ["mrt"];

  private config: DepthOfFieldConfig;

  constructor(view: ViewContext, config: DepthOfFieldConfig) {
    super(view, config);
    this.config = config;
  }

  createPass() {
    const pass = new DepthOfField(this.view.camera, {
      ...this.config.depthOfField,
      enabled: this.config.visible ?? true,
    });

    return pass;
  }

  onUpdateConfig(updates: DepthOfFieldUpdate): void {
    super.onUpdateConfig(updates);

    if (!this._instance) return;
    Object.assign(this.config, updates);

    const config = updates.depthOfField;
    if (!config) return;

    if (config.bokehScale !== undefined) {
      this._instance.bokehScale = config.bokehScale;
    }

    if (config.focusDistance !== undefined) {
      this._instance.focusDistance = config.focusDistance;
    }

    if (config.focalLength !== undefined) {
      this._instance.focalLength = config.focalLength;
    }
  }
}
