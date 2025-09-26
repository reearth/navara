import {
  EffectLayerDeclaration,
  type EffectLayerConfig,
  type EffectLayerUpdate,
} from "../../core/EffectLayerDeclaration";
import type { ViewContext } from "../../core/ViewContext";
import {
  RainDropEffect,
  type RainDropOptions,
} from "../../effects/rainDropEffect/effect";

type LayerDescription = {
  rainDrop?: Omit<RainDropOptions, "enabled">;
};

export type RainDropConfig = LayerDescription & EffectLayerConfig;

export type RainDropUpdate = LayerDescription & EffectLayerUpdate;

export class RainDropEffectLayer extends EffectLayerDeclaration<
  RainDropConfig,
  RainDropUpdate,
  RainDropEffect
> {
  static key = "rainDrop";
  static insertBefore = ["final"];
  static allowDuplication = true;

  private config: RainDropConfig;

  constructor(view: ViewContext, config: RainDropConfig) {
    super(view, config);
    this.config = config;
  }

  createPass(): RainDropEffect {
    const cfg = this.config.rainDrop ?? {};
    return new RainDropEffect(this.view.camera, {
      ...cfg,
      enabled: this.config.visible ?? true,
    });
  }

  onUpdateConfig(updates: RainDropUpdate): void {
    if (!this._instance) return;

    super.onUpdateConfig(updates);

    if (updates.rainDrop) {
      const cfg = updates.rainDrop;
      if (cfg.opacity !== undefined) {
        this._instance.opacity = cfg.opacity;
      }
      if (cfg.dropGridSize !== undefined) {
        this._instance.dropGridSize = cfg.dropGridSize;
      }
      if (cfg.timeOffset !== undefined) {
        this._instance.timeOffset = cfg.timeOffset;
      }
    }

    if (updates.visible !== undefined) {
      this._instance.enabled = updates.visible;
    }
  }

  update(time: number): void {
    if (this._instance) {
      this._instance.update(time);
    }
  }
}
