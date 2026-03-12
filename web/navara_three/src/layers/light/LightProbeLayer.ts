import { LightProbe, SphericalHarmonics3, Vector3 } from "three";

import {
  LightLayerDeclaration,
  type LightLayerConfig,
  type LightLayerUpdate,
  type ViewContext,
} from "../../core";

type LayerDescription = {
  lightProbe?: {
    intensity?: number;
    sh?: SphericalHarmonics3;
    coefficients?: number[][];
  };
};

export type LightProbeLayerConfig = LightLayerConfig & LayerDescription;

export type LightProbeLayerUpdate = LightLayerUpdate & LayerDescription;

export class LightProbeLayer extends LightLayerDeclaration<
  LightProbeLayerConfig,
  LightProbeLayerUpdate,
  LightProbe
> {
  private config: LightProbeLayerConfig;

  constructor(view: ViewContext, config: LightProbeLayerConfig) {
    super(view, config);
    this.config = config;
  }

  createLight(): LightProbe {
    const probeConfig = this.config.lightProbe;

    const lightProbe = new LightProbe(
      probeConfig?.sh,
      probeConfig?.intensity ?? 1,
    );

    // If coefficients are provided, set them
    if (probeConfig?.coefficients) {
      const sh = new SphericalHarmonics3();
      sh.coefficients = probeConfig.coefficients.map(
        (coeff) => new Vector3(coeff[0] ?? 0, coeff[1] ?? 0, coeff[2] ?? 0),
      );
      lightProbe.sh = sh;
    }

    return lightProbe;
  }

  onUpdateConfig(updates: LightProbeLayerUpdate): void {
    if (updates.lightProbe && this._instance) {
      const probeConfig = updates.lightProbe;

      if (probeConfig.intensity !== undefined) {
        this._instance.intensity = probeConfig.intensity;
      }

      if (probeConfig.sh) {
        this._instance.sh = probeConfig.sh;
      }

      if (probeConfig.coefficients) {
        const sh = new SphericalHarmonics3();
        sh.coefficients = probeConfig.coefficients.map(
          (coeff) => new Vector3(coeff[0] ?? 0, coeff[1] ?? 0, coeff[2] ?? 0),
        );
        this._instance.sh = sh;
      }

      this.emit("needsUpdate");
    }

    super.onUpdateConfig(updates);
  }

  protected disposeLight(): void {
    // LightProbe doesn't have a dispose method
    this._instance = undefined;
  }
}
