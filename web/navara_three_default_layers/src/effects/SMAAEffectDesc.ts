import type ThreeView from "@navara/three";
import {
  EffectDesc,
  type EffectConfig,
  type EffectUpdate,
  type ViewContext,
} from "@navara/three";

import { SMAA, type AntialiasOptions } from "./aa";

type Description = {
  smaa?: Omit<AntialiasOptions, "enabled">;
};

export type SMAAConfig = Description & EffectConfig;

export type SMAAUpdate = Description & EffectUpdate;

export class SMAAEffectDesc extends EffectDesc<SMAAConfig, SMAAUpdate, SMAA> {
  static key = "smaa";
  static insertBefore = ["final"];

  private config: SMAAConfig;

  constructor(view: ThreeView, ctx: ViewContext, config: SMAAConfig) {
    super(view, ctx, config);
    this.config = config;
  }

  createPass() {
    const pass = new SMAA(this.view.camera.raw, {
      ...this.config.smaa,
      enabled: this.config.visible ?? true,
    });

    return pass;
  }

  onUpdateConfig(updates: SMAAUpdate): void {
    super.onUpdateConfig(updates);

    if (!this._instance) return;
    Object.assign(this.config, updates);

    const config = updates.smaa;
    if (!config) return;

    if (config.quality !== undefined) {
      this._instance.quality = config.quality;
    }
    if (config.edgeDetectionMode !== undefined) {
      this._instance.edgeDetectionMode = config.edgeDetectionMode;
    }
  }
}
