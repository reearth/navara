import { Color } from "three";

import {
  LightLayerDeclaration,
  type LightLayerConfig,
  ViewContext,
} from "../../core";
import { AmbientLight, type AmbientLightOptions } from "../../lights";

type LayerDescription = {
  ambient?: Omit<AmbientLightOptions, "color"> & {
    color?: number;
  };
};

export type AmbientLightLayerConfig = LightLayerConfig & LayerDescription;

export type AmbientLightLayerUpdate = Pick<LightLayerConfig, "visible"> &
  LayerDescription;

export class AmbientLightLayer extends LightLayerDeclaration<
  AmbientLightLayerConfig,
  AmbientLightLayerUpdate,
  AmbientLight
> {
  private config: AmbientLightLayerConfig;

  constructor(view: ViewContext, config: AmbientLightLayerConfig) {
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
      options.color = new Color(ambientConfig.color);
    }

    const light = new AmbientLight(options);

    light.on("_needsUpdate", () => this.emit("_needsUpdate"));

    return light;
  }

  onUpdateConfig(updates: AmbientLightLayerUpdate): void {
    super.onUpdateConfig(updates);

    if (this.config.ambient && updates.ambient && this.instance) {
      Object.assign(this.config.ambient, updates.ambient);

      // Update intensity
      if (updates.ambient.intensity !== undefined) {
        this.instance.intensity = updates.ambient.intensity;
      }

      // Update color
      if (updates.ambient.color !== undefined) {
        this.instance.color = new Color(updates.ambient.color);
      }
    }
  }

  getAmbientLight(): AmbientLight | null {
    return this.instance;
  }
}
