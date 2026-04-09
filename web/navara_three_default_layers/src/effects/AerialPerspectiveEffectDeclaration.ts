import {
  EffectDeclaration,
  type EffectConfig,
  type EffectUpdate,
  type ViewContext,
  type MRTPassEffectDeclaration,
} from "@navara/three";
import invariant from "tiny-invariant";

import {
  AerialPerspective,
  type AerialPerspectiveOptions,
} from "./aerialPerspective";

type LayerDescription = {
  aerialPerspective?: Omit<AerialPerspectiveOptions, "enabled">;
};

export type AerialPerspectiveConfig = LayerDescription & EffectConfig;

export type AerialPerspectiveUpdate = LayerDescription & EffectUpdate;

export class AerialPerspectiveEffectDeclaration extends EffectDeclaration<
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
    const mrtPass = this.findLayer<MRTPassEffectDeclaration>("mrt");
    invariant(mrtPass?.normalBuffer && mrtPass.depthBuffer);

    const pass = new AerialPerspective(
      this.view.atmosphere,
      this.view.camera,
      mrtPass.normalBuffer,
      {
        ...this.config.aerialPerspective,
        enabled: this.config.visible ?? true,
      },
    );

    pass.raw.setCustomDepthTexture(
      mrtPass.depthBuffer,
      mrtPass.depthBufferPacking,
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
    if (config.sky !== undefined) {
      this._instance.sky = config.sky;
    }
    if (config.sun !== undefined) {
      this._instance.sun = config.sun;
    }
    if (config.moon !== undefined) {
      this._instance.moon = config.moon;
    }
  }

  update(_time: number): void {
    this._instance?._update();
  }
}
