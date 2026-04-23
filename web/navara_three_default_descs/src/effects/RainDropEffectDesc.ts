import type ThreeView from "@navara/three";
import {
  EffectDesc,
  type EffectConfig,
  type EffectUpdate,
  type ViewContext,
} from "@navara/three";

import { RainDropEffect, type RainDropOptions } from "./rainDropEffect";

type Description = {
  rainDrop?: Omit<RainDropOptions, "enabled">;
};

export type RainDropConfig = Description & EffectConfig;

export type RainDropUpdate = Description & EffectUpdate;

export class RainDropEffectDesc extends EffectDesc<
  RainDropConfig,
  RainDropUpdate,
  RainDropEffect
> {
  static key = "rainDrop";
  static insertBefore = ["final"];
  static allowDuplication = true;

  private config: RainDropConfig;

  constructor(view: ThreeView, ctx: ViewContext, config: RainDropConfig) {
    super(view, ctx, config);
    this.config = config;
  }

  createPass(): RainDropEffect {
    const cfg = this.config.rainDrop ?? {};
    return new RainDropEffect(this.view.camera.raw, {
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
      if (cfg.dropDensity !== undefined) {
        this._instance.dropDensity = cfg.dropDensity;
      }
      if (cfg.dropLayers !== undefined) {
        this._instance.dropLayers = cfg.dropLayers;
      }
      if (cfg.dropSizeFactor !== undefined) {
        this._instance.dropSizeFactor = cfg.dropSizeFactor;
      }
      if (cfg.noiseScale !== undefined) {
        this._instance.noiseScale = cfg.noiseScale;
      }
      if (cfg.refractionStrength !== undefined) {
        this._instance.refractionStrength = cfg.refractionStrength;
      }
      if (cfg.minDropStrength !== undefined) {
        this._instance.minDropStrength = cfg.minDropStrength;
      }
      if (cfg.dropFadeStart !== undefined) {
        this._instance.dropFadeStart = cfg.dropFadeStart;
      }
      if (cfg.dropFadeEnd !== undefined) {
        this._instance.dropFadeEnd = cfg.dropFadeEnd;
      }
      if (cfg.dropThresholdFactor !== undefined) {
        this._instance.dropThresholdFactor = cfg.dropThresholdFactor;
      }
      if (cfg.gridDensityLow !== undefined) {
        this._instance.gridDensityLow = cfg.gridDensityLow;
      }
      if (cfg.gridDensityHigh !== undefined) {
        this._instance.gridDensityHigh = cfg.gridDensityHigh;
      }
      if (cfg.jitterStrengthLow !== undefined) {
        this._instance.jitterStrengthLow = cfg.jitterStrengthLow;
      }
      if (cfg.jitterStrengthHigh !== undefined) {
        this._instance.jitterStrengthHigh = cfg.jitterStrengthHigh;
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
