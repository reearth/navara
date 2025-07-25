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

    if (!this.instance) return;
    Object.assign(this.config, updates);

    const config = updates.clouds;
    if (!config) return;

    // Update all possible cloud properties
    if (config.qualityPreset !== undefined) {
      this.instance.qualityPreset = config.qualityPreset;
    }
    if (config.localWeatherVelocity !== undefined) {
      this.instance.localWeatherVelocity = config.localWeatherVelocity;
    }
    if (config.coverage !== undefined) {
      this.instance.coverage = config.coverage;
    }
    if (config.lightShafts !== undefined && config.lightShafts !== null) {
      this.instance.lightShafts = config.lightShafts;
    }
    if (config.resolutionScale !== undefined) {
      this.instance.resolutionScale = config.resolutionScale;
    }
    if (
      config.maxIterationCount !== undefined &&
      config.maxIterationCount !== null
    ) {
      this.instance.maxIterationCount = config.maxIterationCount;
    }
    if (config.minStepSize !== undefined && config.minStepSize !== null) {
      this.instance.minStepSize = config.minStepSize;
    }
    if (config.maxStepSize !== undefined && config.maxStepSize !== null) {
      this.instance.maxStepSize = config.maxStepSize;
    }

    // Shadow properties
    if (config.shadows !== undefined) {
      this.instance.shadows = config.shadows;
    }
    if (config.shadowCascadeCount !== undefined) {
      this.instance.shadowCascadeCount = config.shadowCascadeCount;
    }
    if (config.shadowMapSize !== undefined) {
      this.instance.shadowMapSize = config.shadowMapSize;
    }
    if (config.shadowFarScale !== undefined) {
      this.instance.shadowFarScale = config.shadowFarScale;
    }

    // Haze properties
    if (config.haze !== undefined) {
      this.instance.haze = config.haze;
    }
    if (config.hazeDensityScale !== undefined) {
      this.instance.hazeDensityScale = config.hazeDensityScale;
    }
    if (config.hazeExponent !== undefined) {
      this.instance.hazeExponent = config.hazeExponent;
    }
    if (config.hazeScatteringCoefficient !== undefined) {
      this.instance.hazeScatteringCoefficient =
        config.hazeScatteringCoefficient;
    }
    if (config.hazeAbsorptionCoefficient !== undefined) {
      this.instance.hazeAbsorptionCoefficient =
        config.hazeAbsorptionCoefficient;
    }

    // Weather and shape properties
    if (config.localWeatherRepeat !== undefined) {
      this.instance.localWeatherRepeat = config.localWeatherRepeat;
    }
    if (config.localWeatherOffset !== undefined) {
      this.instance.localWeatherOffset = config.localWeatherOffset;
    }
    if (config.shapeRepeat !== undefined) {
      this.instance.shapeRepeat = config.shapeRepeat;
    }
    if (config.shapeOffset !== undefined) {
      this.instance.shapeOffset = config.shapeOffset;
    }
    if (config.shapeDetailRepeat !== undefined) {
      this.instance.shapeDetailRepeat = config.shapeDetailRepeat;
    }
    if (config.shapeDetailOffset !== undefined) {
      this.instance.shapeDetailOffset = config.shapeDetailOffset;
    }
    if (config.turbulenceRepeat !== undefined) {
      this.instance.turbulenceRepeat = config.turbulenceRepeat;
    }
    if (config.turbulenceDisplacement !== undefined) {
      this.instance.turbulenceDisplacement = config.turbulenceDisplacement;
    }

    // Scattering properties
    if (config.scatteringCoefficient !== undefined) {
      this.instance.scatteringCoefficient = config.scatteringCoefficient;
    }
    if (config.absorptionCoefficient !== undefined) {
      this.instance.absorptionCoefficient = config.absorptionCoefficient;
    }
    if (config.scatterAnisotropy1 !== undefined) {
      this.instance.scatterAnisotropy1 = config.scatterAnisotropy1;
    }
    if (config.scatterAnisotropy2 !== undefined) {
      this.instance.scatterAnisotropy2 = config.scatterAnisotropy2;
    }
    if (config.scatterAnisotropyMix !== undefined) {
      this.instance.scatterAnisotropyMix = config.scatterAnisotropyMix;
    }
    if (config.skyLightScale !== undefined) {
      this.instance.skyLightScale = config.skyLightScale;
    }
    if (config.groundBounceScale !== undefined) {
      this.instance.groundBounceScale = config.groundBounceScale;
    }
    if (config.powderScale !== undefined) {
      this.instance.powderScale = config.powderScale;
    }
    if (config.powderExponent !== undefined) {
      this.instance.powderExponent = config.powderExponent;
    }
  }

  update(_time: number): void {
    this.instance?._update();
  }
}
