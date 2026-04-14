import type ThreeView from "@navara/three";
import { Color } from "@navara/three";
import {
  LightLayerDeclaration,
  type LightLayerConfig,
  type ViewContext,
  type LightLayerUpdate,
} from "@navara/three";

import { AmbientLight, type AmbientLightOptions } from "./ambientLight";

type LayerDescription = {
  ambient?: Omit<AmbientLightOptions, "color"> & {
    color?: Color;
  };
};

export type AmbientLightLayerConfig = LightLayerConfig & LayerDescription;

export type AmbientLightLayerUpdate = LightLayerUpdate & LayerDescription;

export class AmbientLightLayer extends LightLayerDeclaration<
  AmbientLightLayerConfig,
  AmbientLightLayerUpdate,
  AmbientLight
> {
  private config: AmbientLightLayerConfig;

  constructor(
    view: ThreeView,
    ctx: ViewContext,
    config: AmbientLightLayerConfig,
  ) {
    super(view, ctx, config);
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

  onUpdateConfig(updates: AmbientLightLayerUpdate): void {
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
