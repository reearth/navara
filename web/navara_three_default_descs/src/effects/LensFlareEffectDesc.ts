import type ThreeView from "@navara/three";
import {
  EffectDesc,
  type EffectConfig,
  type EffectUpdate,
  type ViewContext,
} from "@navara/three";

import { LensFlare, type LensFlareOptions } from "./lensFlare";

type Description = {
  lensFlare?: Omit<LensFlareOptions, "enabled">;
};

export type LensFlareConfig = Description & EffectConfig;

export type LensFlareUpdate = Description & EffectUpdate;

export class LensFlareEffectDesc extends EffectDesc<
  LensFlareConfig,
  LensFlareUpdate,
  LensFlare
> {
  static key = "lensFlare";
  static insertAfter = ["clouds"];
  static insertBefore = ["transparent"];

  private config: LensFlareConfig;

  constructor(view: ThreeView, ctx: ViewContext, config: LensFlareConfig) {
    super(view, ctx, config);
    this.config = config;
  }

  createPass() {
    const pass = new LensFlare(this.view.camera.raw, {
      ...this.config.lensFlare,
      enabled: this.config.visible ?? true,
    });

    return pass;
  }

  onUpdateConfig(updates: LensFlareUpdate): void {
    super.onUpdateConfig(updates);

    if (!this._instance) return;
    Object.assign(this.config, updates);

    const config = updates.lensFlare;
    if (!config) return;

    if (config.intensity !== undefined) {
      this._instance.intensity = config.intensity;
    }
  }
}
