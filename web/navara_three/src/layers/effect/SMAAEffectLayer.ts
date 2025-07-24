import {
  EffectLayerDeclaration,
  type EffectLayerConfig,
  type EffectLayerUpdate,
} from "../../core/EffectLayerDeclaration";
import type { ViewContext } from "../../core/ViewContext";
import { SMAA, type AntialiasOptions } from "../../effects";

type LayerDescription = {
  smaa?: Omit<AntialiasOptions, "enabled">;
};

export type SMAAConfig = LayerDescription & EffectLayerConfig;

export type SMAAUpdate = LayerDescription & EffectLayerUpdate;

export class SMAAEffectLayer extends EffectLayerDeclaration<
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

    if (!this.instance) return;
    Object.assign(this.config, updates);

    const config = updates.smaa;
    if (!config) return;

    if (config.quality !== undefined) {
      this.instance.quality = config.quality;
    }
    if (config.edgeDetectionMode !== undefined) {
      this.instance.edgeDetectionMode = config.edgeDetectionMode;
    }
  }
}
