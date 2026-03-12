// No additional imports needed from three

import {
  LightLayerDeclaration,
  type LightLayerConfig,
  ViewContext,
  type LightLayerUpdate,
} from "../../core";
import { SkyLightProbe, type SkyLightProbeOptions } from "../../lights";

type LayerDescription = {
  skyLightProbe?: SkyLightProbeOptions;
};

export type SkyLightProbeLayerConfig = LightLayerConfig & LayerDescription;

export type SkyLightProbeLayerUpdate = LightLayerUpdate & LayerDescription;

export class SkyLightProbeLayer extends LightLayerDeclaration<
  SkyLightProbeLayerConfig,
  SkyLightProbeLayerUpdate,
  SkyLightProbe
> {
  private config: SkyLightProbeLayerConfig;

  constructor(view: ViewContext, config: SkyLightProbeLayerConfig) {
    super(view, config);
    this.config = config;
  }

  createLight() {
    const skyLightProbeConfig = this.config.skyLightProbe || {};

    const skyLightProbe = new SkyLightProbe(skyLightProbeConfig);

    // Set up atmosphere integration
    this.view.atmosphere.onTexturesReady((t) => skyLightProbe.setTextures(t));

    skyLightProbe.on("needsUpdate", () => this.emit("needsUpdate"));

    return skyLightProbe;
  }

  onUpdateConfig(updates: SkyLightProbeLayerUpdate): void {
    super.onUpdateConfig(updates);

    if (this.config.skyLightProbe && updates.skyLightProbe && this._instance) {
      Object.assign(this.config.skyLightProbe, updates.skyLightProbe);

      // Update intensity if provided
      if (updates.skyLightProbe.intensity !== undefined) {
        this._instance.intensity = updates.skyLightProbe.intensity;
      }
    }
  }

  update(_time: number): void {
    if (!this._instance) return;

    // Update sky light probe with current atmosphere state
    this._instance.updateSunDirection(this.view.atmosphere.sunDirection);

    // Update position to camera position for proper lighting
    const cameraPosition = this.view.camera.position;
    this._instance.updatePosition(cameraPosition);

    this._instance.update();
  }
}
