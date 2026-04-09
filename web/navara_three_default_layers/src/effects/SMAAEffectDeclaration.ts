import {
  EffectDeclaration,
  type EffectConfig,
  type EffectUpdate,
  type ViewContext,
} from "@navara/three";

import { SMAA, type AntialiasOptions } from "./aa";

type LayerDescription = {
  smaa?: Omit<AntialiasOptions, "enabled">;
};

export type SMAAConfig = LayerDescription & EffectConfig;

export type SMAAUpdate = LayerDescription & EffectUpdate;

export class SMAAEffectDeclaration extends EffectDeclaration<
  SMAAConfig,
  SMAAUpdate,
  SMAA
> {
  static key = "smaa";
  static insertBefore = ["final"];

  private config: SMAAConfig;

  constructor(view: ViewContext, config: SMAAConfig) {
    super(view, config);
    this.config = config;
  }

  createPass() {
    const pass = new SMAA(this.view.camera, {
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
