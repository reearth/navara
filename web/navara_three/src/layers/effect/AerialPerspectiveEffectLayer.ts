import invariant from "tiny-invariant";

import {
  EffectLayerDeclaration,
  type EffectLayerConfig,
  type EffectLayerUpdate,
} from "../../core/EffectLayerDeclaration";
import type { ViewContext } from "../../core/ViewContext";
import {
  AerialPerspective,
  type AerialPerspectiveOptions,
} from "../../effects";

import type { MRTPassEffectLayer } from "./MRTPassEffectLayer";

type LayerDescription = {
  aerialPerspective?: Omit<AerialPerspectiveOptions, "enabled">;
};

export type AerialPerspectiveConfig = LayerDescription & EffectLayerConfig;

export type AerialPerspectiveUpdate = LayerDescription & EffectLayerUpdate;

export class AerialPerspectiveEffectLayer extends EffectLayerDeclaration<
  AerialPerspectiveConfig,
  AerialPerspectiveUpdate,
  AerialPerspective
> {
  static key = "aerialPerspective";
  static insertAfter = ["mrt"];

  private config: AerialPerspectiveConfig;

  constructor(view: ViewContext, config: AerialPerspectiveConfig) {
    super(view, config);
    this.config = config;
  }

  createPass() {
    const mrtPass = this.findLayer<MRTPassEffectLayer>("mrt");
    invariant(mrtPass?.raw);

    const pass = new AerialPerspective(
      this.view.atmosphere,
      this.view.camera,
      mrtPass.raw.gbufferRenderTarget.textures[1],
      {
        ...this.config.aerialPerspective,
        enabled: this.config.visible ?? true,
      },
    );

    return pass;
  }

  onUpdateConfig(updates: AerialPerspectiveUpdate): void {
    super.onUpdateConfig(updates);

    if (!this._instance) return;
    Object.assign(this.config, updates);

    const config = updates.aerialPerspective;
    if (!config) return;

    if (config.inscatter !== undefined) {
      this._instance.inscatter = config.inscatter;
    }
    if (config.transmittance !== undefined) {
      this._instance.transmittance = config.transmittance;
    }
    if (config.irradiance !== undefined) {
      this._instance.irradiance = config.irradiance;
    }
  }

  update(_time: number): void {
    this._instance?._update();
  }
}
