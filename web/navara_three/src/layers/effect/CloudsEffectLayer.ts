import {
  EffectLayerDeclaration,
  type EffectLayerConfig,
  type EffectLayerUpdate,
} from "../../core/EffectLayerDeclaration";
import type { ViewContext } from "../../core/ViewContext";
import { Clouds, type CloudsOptions } from "../../effects";

type LayerDescription = {
  clouds?: Omit<CloudsOptions, "enabled">;
};

export type CloudsConfig = LayerDescription & EffectLayerConfig;

export type CloudsUpdate = LayerDescription & EffectLayerUpdate;

export class CloudsEffectLayer extends EffectLayerDeclaration<
  CloudsConfig,
  CloudsUpdate,
  Clouds
> {
  static key = "clouds";
  static insertAfter = ["aerialPerspective"];

  private config: CloudsConfig;

  constructor(view: ViewContext, config: CloudsConfig) {
    super(view, config);
    this.config = config;
  }

  createPass() {
    const pass = new Clouds(this.view.camera, this.view.atmosphere, {
      ...this.config.clouds,
      enabled: this.config.visible ?? true,
    });

    return pass;
  }

  onUpdateConfig(updates: CloudsUpdate): void {
    super.onUpdateConfig(updates);

    if (!this._instance) return;
    Object.assign(this.config, updates);

    const config = updates.clouds;
    if (!config) return;

    // Update all possible cloud properties
    if (config.qualityPreset !== undefined) {
      this._instance.qualityPreset = config.qualityPreset;
    }
    if (config.localWeatherVelocity !== undefined) {
      this._instance.localWeatherVelocity = config.localWeatherVelocity;
    }
    if (config.coverage !== undefined) {
      this._instance.coverage = config.coverage;
    }
    if (config.lightShafts !== undefined && config.lightShafts !== null) {
      this._instance.lightShafts = config.lightShafts;
    }
    if (config.resolutionScale !== undefined) {
      this._instance.resolutionScale = config.resolutionScale;
    }
    if (
      config.maxIterationCount !== undefined &&
      config.maxIterationCount !== null
    ) {
      this._instance.maxIterationCount = config.maxIterationCount;
    }
    if (config.minStepSize !== undefined && config.minStepSize !== null) {
      this._instance.minStepSize = config.minStepSize;
    }
    if (config.maxStepSize !== undefined && config.maxStepSize !== null) {
      this._instance.maxStepSize = config.maxStepSize;
    }

    // Shadow properties
    if (config.shadows !== undefined) {
      this._instance.shadows = config.shadows;
    }
    if (config.shadowCascadeCount !== undefined) {
      this._instance.shadowCascadeCount = config.shadowCascadeCount;
    }
    if (config.shadowMapSize !== undefined) {
      this._instance.shadowMapSize = config.shadowMapSize;
    }
    if (config.shadowFarScale !== undefined) {
      this._instance.shadowFarScale = config.shadowFarScale;
    }

    // Haze properties
    if (config.haze !== undefined) {
      this._instance.haze = config.haze;
    }
    if (config.hazeDensityScale !== undefined) {
      this._instance.hazeDensityScale = config.hazeDensityScale;
    }
    if (config.hazeExponent !== undefined) {
      this._instance.hazeExponent = config.hazeExponent;
    }
    if (config.hazeScatteringCoefficient !== undefined) {
      this._instance.hazeScatteringCoefficient =
        config.hazeScatteringCoefficient;
    }
    if (config.hazeAbsorptionCoefficient !== undefined) {
      this._instance.hazeAbsorptionCoefficient =
        config.hazeAbsorptionCoefficient;
    }

    // Weather and shape properties
    if (config.localWeatherRepeat !== undefined) {
      this._instance.localWeatherRepeat = config.localWeatherRepeat;
    }
    if (config.localWeatherOffset !== undefined) {
      this._instance.localWeatherOffset = config.localWeatherOffset;
    }
    if (config.shapeRepeat !== undefined) {
      this._instance.shapeRepeat = config.shapeRepeat;
    }
    if (config.shapeOffset !== undefined) {
      this._instance.shapeOffset = config.shapeOffset;
    }
    if (config.shapeDetailRepeat !== undefined) {
      this._instance.shapeDetailRepeat = config.shapeDetailRepeat;
    }
    if (config.shapeDetailOffset !== undefined) {
      this._instance.shapeDetailOffset = config.shapeDetailOffset;
    }
    if (config.turbulenceRepeat !== undefined) {
      this._instance.turbulenceRepeat = config.turbulenceRepeat;
    }
    if (config.turbulenceDisplacement !== undefined) {
      this._instance.turbulenceDisplacement = config.turbulenceDisplacement;
    }

    // Scattering properties
    if (config.scatteringCoefficient !== undefined) {
      this._instance.scatteringCoefficient = config.scatteringCoefficient;
    }
    if (config.absorptionCoefficient !== undefined) {
      this._instance.absorptionCoefficient = config.absorptionCoefficient;
    }
    if (config.scatterAnisotropy1 !== undefined) {
      this._instance.scatterAnisotropy1 = config.scatterAnisotropy1;
    }
    if (config.scatterAnisotropy2 !== undefined) {
      this._instance.scatterAnisotropy2 = config.scatterAnisotropy2;
    }
    if (config.scatterAnisotropyMix !== undefined) {
      this._instance.scatterAnisotropyMix = config.scatterAnisotropyMix;
    }
    if (config.skyLightScale !== undefined) {
      this._instance.skyLightScale = config.skyLightScale;
    }
    if (config.groundBounceScale !== undefined) {
      this._instance.groundBounceScale = config.groundBounceScale;
    }
    if (config.powderScale !== undefined) {
      this._instance.powderScale = config.powderScale;
    }
    if (config.powderExponent !== undefined) {
      this._instance.powderExponent = config.powderExponent;
    }
  }

  update(_time: number): void {
    this._instance?._update();
  }
}
