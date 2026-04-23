import type ThreeView from "@navara/three";
import {
  EffectDesc,
  type EffectConfig,
  type EffectUpdate,
  type ViewContext,
} from "@navara/three";

import { DepthOfField, type DepthOfFieldOptions } from "./depthOfField";

type Description = {
  depthOfField?: Omit<DepthOfFieldOptions, "enabled">;
};

export type DepthOfFieldConfig = Description & EffectConfig;

export type DepthOfFieldUpdate = Description & EffectUpdate;

export class DepthOfFieldEffectDesc extends EffectDesc<
  DepthOfFieldConfig,
  DepthOfFieldUpdate,
  DepthOfField
> {
  static key = "depthOfField";
  static insertAfter = ["mrt"];

  private config: DepthOfFieldConfig;

  constructor(view: ThreeView, ctx: ViewContext, config: DepthOfFieldConfig) {
    super(view, ctx, config);
    this.config = config;
  }

  createPass() {
    const pass = new DepthOfField(this.view.camera.raw, {
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
