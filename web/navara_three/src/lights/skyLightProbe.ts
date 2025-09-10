import { EventHandler } from "@navara/core";
import {
  SkyLightProbe as SkyLightProbeImpl,
  type PrecomputedTextures,
} from "@takram/three-atmosphere";
import { Vector3 } from "three";

export type SkyLightProbeEvents = {
  _needsUpdate: () => void;
};

export type SkyLightProbeOptions = {
  intensity?: number;
};

export class SkyLightProbe extends EventHandler<SkyLightProbeEvents> {
  raw: SkyLightProbeImpl;

  constructor(options: SkyLightProbeOptions = {}) {
    super();

    this.raw = new SkyLightProbeImpl();

    if (options.intensity !== undefined) {
      this.raw.intensity = options.intensity;
    }
  }

  setTextures(textures: PrecomputedTextures) {
    this.raw.irradianceTexture = textures.irradianceTexture;
  }

  updateSunDirection(sunDirection: Vector3) {
    this.raw.sunDirection.copy(sunDirection);
  }

  updatePosition(position: Vector3) {
    this.raw.position.copy(position);
  }

  get visible() {
    return this.raw.visible;
  }
  set visible(v: boolean) {
    this.raw.visible = v;
    this.emit("_needsUpdate");
  }

  get intensity() {
    return this.raw.intensity;
  }
  set intensity(v: number) {
    this.raw.intensity = v;
    this.emit("_needsUpdate");
  }

  update() {
    this.raw.update();
  }
}
