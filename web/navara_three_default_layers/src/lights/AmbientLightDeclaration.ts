import { Color } from "@navara/three";
import {
  LightDeclaration,
  type LightConfig,
  ViewContext,
  type LightUpdate,
} from "@navara/three";

import { AmbientLight, type AmbientLightOptions } from "./ambientLight";

type LayerDescription = {
  ambient?: Omit<AmbientLightOptions, "color"> & {
    color?: Color;
  };
};

export type AmbientLightConfig = LightConfig & LayerDescription;

export type AmbientLightUpdate = LightUpdate & LayerDescription;

export class AmbientLightDeclaration extends LightDeclaration<
  AmbientLightConfig,
  AmbientLightUpdate,
  AmbientLight
> {
  private config: AmbientLightConfig;

  constructor(view: ViewContext, config: AmbientLightConfig) {
    super(view, config);
    this.config = config;
  }

  createLight() {
    const ambientConfig = this.config.ambient || {};

    const options: AmbientLightOptions = {
      intensity: ambientConfig.intensity ?? 1,
    };

    // Handle color conversion
    if (ambientConfig.color !== undefined) {
      options.color = ambientConfig.color.raw;
    }

    const light = new AmbientLight(options);

    light.on("needsUpdate", () => this.emit("needsUpdate"));

    return light;
  }

  onUpdateConfig(updates: AmbientLightUpdate): void {
    super.onUpdateConfig(updates);

    if (this.config.ambient && updates.ambient && this._instance) {
      Object.assign(this.config.ambient, updates.ambient);

      // Update intensity
      if (updates.ambient.intensity !== undefined) {
        this._instance.intensity = updates.ambient.intensity;
      }

      // Update color
      if (updates.ambient.color !== undefined) {
        this._instance.color = updates.ambient.color.raw;
      }
    }
  }
}
