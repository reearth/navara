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
  static insertAfter = ["toneMapping"];
  static insertBefore = ["final"];

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

    if (updates.fogLight) {
      const config = updates.fogLight;

      if (config.lights !== undefined) {
        this._instance.lights = config.lights;
      }

      if (config.fogDensity !== undefined) {
        this._instance.fogDensity = config.fogDensity;
      }

      if (config.useSurfaceLighting !== undefined) {
        this._instance.useSurfaceLighting = config.useSurfaceLighting;
      }
    }

    if (updates.visible !== undefined) {
      this._instance.enabled = updates.visible;
    }
  }
}
