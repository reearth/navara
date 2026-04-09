import {
  LightDeclaration,
  type LightConfig,
  ViewContext,
  type LightUpdate,
} from "@navara/three";

import { SkyLightProbe, type SkyLightProbeOptions } from "./skyLightProbe";

type LayerDescription = {
  skyLightProbe?: SkyLightProbeOptions;
};

export type SkyLightProbeConfig = LightConfig & LayerDescription;

export type SkyLightProbeUpdate = LightUpdate & LayerDescription;

export class SkyLightProbeDeclaration extends LightDeclaration<
  SkyLightProbeConfig,
  SkyLightProbeUpdate,
  SkyLightProbe
> {
  private config: SkyLightProbeConfig;

  constructor(view: ViewContext, config: SkyLightProbeConfig) {
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

  onUpdateConfig(updates: SkyLightProbeUpdate): void {
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
