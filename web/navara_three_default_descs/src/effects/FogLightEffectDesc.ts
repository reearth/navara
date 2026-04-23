import type ThreeView from "@navara/three";
import {
  EffectDesc,
  type EffectConfig,
  type EffectUpdate,
  type ViewContext,
  type MRTPassEffectDesc,
} from "@navara/three";
import invariant from "tiny-invariant";

import { FogLight, type FogLightOptions } from "./fogLight";

type Description = {
  fogLight?: Omit<FogLightOptions, "enabled">;
};

export type FogLightConfig = Description & EffectConfig;

export type FogLightUpdate = Description & EffectUpdate;

export class FogLightEffectDesc extends EffectDesc<
  FogLightConfig,
  FogLightUpdate,
  FogLight
> {
  static key = "fogLight";
  static insertBefore = ["toneMapping", "final"];
  static allowDuplication = true;

  private config: FogLightConfig;

  constructor(view: ThreeView, ctx: ViewContext, config: FogLightConfig) {
    super(view, ctx, config);
    this.config = config;
  }

  createPass(): FogLight {
    const mrtPass = this.find<MRTPassEffectDesc>("mrt");
    invariant(mrtPass?.normalBuffer);

    const config = this.config.fogLight ?? {};
    return new FogLight(this.view.camera.raw, {
      ...config,
      normalBuffer: mrtPass.normalBuffer,
      enabled: this.config.visible ?? true,
    });
  }

  onUpdateConfig(updates: FogLightUpdate): void {
    if (!this._instance) return;

    super.onUpdateConfig(updates);

    // Merge config snapshot
    Object.assign(this.config, updates);

    const cfg = updates.fogLight;
    if (cfg) {
      if (cfg.lights !== undefined) {
        this._instance.lights = cfg.lights;
      }
      if (cfg.fogDensity !== undefined) {
        this._instance.fogDensity = cfg.fogDensity;
      }
      if (cfg.useSurfaceLighting !== undefined) {
        this._instance.useSurfaceLighting = cfg.useSurfaceLighting;
      }
      if (cfg.downsample !== undefined) {
        this._instance.downsample = cfg.downsample;
      }
      if (cfg.maxLightsPerTile !== undefined) {
        this._instance.maxLightsPerTile = cfg.maxLightsPerTile;
      }
      if (cfg.extentScale !== undefined) {
        this._instance.extentScale = cfg.extentScale;
      }
      if (cfg.maxFar !== undefined) {
        this._instance.maxFar = cfg.maxFar;
      }
      if (cfg.debugShowGrid !== undefined) {
        this._instance.debugShowGrid = cfg.debugShowGrid;
      }
    }

    if (updates.visible !== undefined) {
      this._instance.enabled = updates.visible;
    }
  }
}
