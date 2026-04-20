import type ThreeView from "@navara/three";
import {
  LightDesc,
  type LightConfig,
  type LightUpdate,
  type ViewContext,
} from "@navara/three";
import { LightProbe, SphericalHarmonics3, Vector3 } from "three";

type Description = {
  lightProbe?: {
    intensity?: number;
    sh?: SphericalHarmonics3;
    coefficients?: number[][];
  };
};

export type LightProbeConfig = LightConfig & Description;

export type LightProbeUpdate = LightUpdate & Description;

export class LightProbeDesc extends LightDesc<
  LightProbeConfig,
  LightProbeUpdate,
  LightProbe
> {
  private config: LightProbeConfig;

  constructor(
    view: ThreeView,
    ctx: ViewContext,
    config: LightProbeConfig,
  ) {
    super(view, ctx, config);
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

  onUpdateConfig(updates: LightProbeUpdate): void {
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
