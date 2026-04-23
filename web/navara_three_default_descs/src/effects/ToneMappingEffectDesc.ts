import type ThreeView from "@navara/three";
import {
  EffectDesc,
  type EffectConfig,
  type EffectUpdate,
  type ViewContext,
} from "@navara/three";

import { ToneMapping, type ToneMappingOptions } from "./toneMapping";

type Description = {
  toneMapping?: Omit<ToneMappingOptions, "enabled">;
};

export type ToneMappingConfig = Description & EffectConfig;

export type ToneMappingUpdate = Description & EffectUpdate;

export class ToneMappingEffectDesc extends EffectDesc<
  ToneMappingConfig,
  ToneMappingUpdate,
  ToneMapping
> {
  static key = "toneMapping";
  static insertBefore = ["final"];

  private config: ToneMappingConfig;

  constructor(view: ThreeView, ctx: ViewContext, config: ToneMappingConfig) {
    super(view, ctx, config);
    this.config = config;
  }

  createPass() {
    const pass = new ToneMapping(this.view.camera.raw, {
      ...this.config.toneMapping,
      enabled: this.config.visible ?? true,
    });

    return pass;
  }

  onUpdateConfig(updates: ToneMappingUpdate): void {
    super.onUpdateConfig(updates);

    if (!this._instance) return;
    Object.assign(this.config, updates);

    const config = updates.toneMapping;
    if (!config) return;

    if (config.mode !== undefined) {
      this._instance.mode = config.mode;
    }
  }
}
