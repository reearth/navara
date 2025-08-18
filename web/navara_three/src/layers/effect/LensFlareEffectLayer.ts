import {
  EffectLayerDeclaration,
  type EffectLayerConfig,
  type EffectLayerUpdate,
} from "../../core/EffectLayerDeclaration";
import type { ViewContext } from "../../core/ViewContext";
import { LensFlare, type LensFlareOptions } from "../../effects";

type LayerDescription = {
  lensFlare?: Omit<LensFlareOptions, "enabled">;
};

export type LensFlareConfig = LayerDescription & EffectLayerConfig;

export type LensFlareUpdate = LayerDescription & EffectLayerUpdate;

export class LensFlareEffectLayer extends EffectLayerDeclaration<
  LensFlareConfig,
  LensFlareUpdate,
  LensFlare
> {
  static key = "lensFlare";
  static insertAfter = ["clouds"];

  private config: LensFlareConfig;

  constructor(view: ViewContext, config: LensFlareConfig) {
    super(view, config);
    this.config = config;
  }

  createPass() {
    const pass = new LensFlare(this.view.camera, {
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
