import invariant from "tiny-invariant";

import {
  EffectLayerDeclaration,
  type EffectLayerConfig,
  type EffectLayerUpdate,
} from "../../core/EffectLayerDeclaration";
import type { ViewContext } from "../../core/ViewContext";
import { FogLight, type FogLightOptions } from "../../effects/fogLight/effect";

import type { MRTPassEffectLayer } from "./MRTPassEffectLayer";

type LayerDescription = {
  fogLight?: Omit<FogLightOptions, "enabled">;
};

export type FogLightConfig = LayerDescription & EffectLayerConfig;

export type FogLightUpdate = LayerDescription & EffectLayerUpdate;

export class FogLightEffectLayer extends EffectLayerDeclaration<
  FogLightConfig,
  FogLightUpdate,
  FogLight
> {
  static key = "fogLight";
  static insertBefore = ["toneMapping", "final"];
  static allowDuplication = true;

  private config: FogLightConfig;

  constructor(view: ViewContext, config: FogLightConfig) {
    super(view, config);
    this.config = config;
  }

  createPass(): FogLight {
    const mrtPass = this.findLayer<MRTPassEffectLayer>("mrt");
    invariant(mrtPass?.raw);

    const config = this.config.fogLight ?? {};
    return new FogLight(this.view.camera, {
      ...config,
      normalBuffer: mrtPass.raw.gbufferRenderTarget.textures[1],
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
      if (cfg.debugShowGrid !== undefined) {
        this._instance.debugShowGrid = cfg.debugShowGrid;
      }
    }

    if (updates.visible !== undefined) {
      this._instance.enabled = updates.visible;
    }
  }
}
