import {
  EffectLayerDeclaration,
  type EffectLayerConfig,
  type EffectLayerUpdate,
} from "../../core/EffectLayerDeclaration";
import type { ViewContext } from "../../core/ViewContext";
import { DepthOfField, type DepthOfFieldOptions } from "../../effects";

type LayerDescription = {
  depthOfField?: Omit<DepthOfFieldOptions, "enabled">;
};

export type DepthOfFieldConfig = LayerDescription & EffectLayerConfig;

export type DepthOfFieldUpdate = LayerDescription & EffectLayerUpdate;

export class DepthOfFieldEffectLayer extends EffectLayerDeclaration<
  DepthOfFieldConfig,
  DepthOfFieldUpdate,
  DepthOfField
> {
  static key = "depthOfField";
  static insertBefore = ["final"];

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

    // if (config.focusRange !== undefined) {
    //   this._instance.focusRange = config.focusRange;
    // }

    if (config.focalLength !== undefined) {
      this._instance.focalLength = config.focalLength;
    }
  }
}

