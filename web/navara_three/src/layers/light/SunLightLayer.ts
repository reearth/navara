import { Color } from "three";
import invariant from "tiny-invariant";

import {
  LightLayerDeclaration,
  type LightLayerConfig,
  ViewContext,
} from "../../core";
import { SunLight, type SunLightOptions } from "../../lights";

type LayerDescription = {
  sun?: Omit<SunLightOptions, "color"> & { color?: number };
};

export type SunLightLayerConfig = LightLayerConfig & LayerDescription;

export type SunLightLayerUpdate = Pick<LightLayerConfig, "visible"> &
  LayerDescription;

export class SunLightLayer extends LightLayerDeclaration<
  SunLightLayerConfig,
  SunLightLayerUpdate,
  SunLight
> {
  private config: SunLightLayerConfig;

  constructor(view: ViewContext, config: SunLightLayerConfig) {
    super(view, config);
    this.config = config;
  }

  createLight() {
    const options = this.config.sun ?? {};
    const color = options.color ? new Color(options.color) : undefined;

    const sunLight = new SunLight({
      ...options,
      ...(color ? { color } : {}),
    } as SunLightOptions);

    // Set up atmosphere integration
    if (this.view.atmosphere.textures) {
      sunLight.setTransmittanceTexture(
        this.view.atmosphere.textures.transmittanceTexture,
      );
    } else {
      const textureLoaded = () => {
        invariant(this.view.atmosphere.textures);
        sunLight.setTransmittanceTexture(
          this.view.atmosphere.textures.transmittanceTexture,
        );
      };
      this.view.atmosphere.on("_textureLoaded", textureLoaded);
    }

    sunLight.on("_needsUpdate", () => this.emit("_needsUpdate"));

    return sunLight;
  }

  onUpdateConfig(updates: SunLightLayerUpdate): void {
    super.onUpdateConfig(updates);

    if (this.config.sun && updates.sun && this.instance) {
      Object.assign(this.config.sun, updates.sun);

      // Update intensity
      if (updates.sun.intensity !== undefined) {
        this.instance.intensity = updates.sun.intensity;
      }

      // Update color
      if (updates.sun.color !== undefined) {
        this.instance.color = new Color(updates.sun.color);
      }

      if (updates.sun.applyColor !== undefined) {
        this.instance.applyColor = updates.sun.applyColor;
      }
    }
  }

  update(_time: number): void {
    if (!this.instance) return;

    // Update sun direction from atmosphere
    this.instance.updateSunDirection(this.view.atmosphere.sunDirection);

    // Update position to camera position for proper lighting.
    const cameraPosition = this.view.camera.position;
    this.instance.updateTargetPosition(cameraPosition);

    this.instance.update();
  }

  getSunLight(): SunLight | null {
    return this.instance;
  }
}
