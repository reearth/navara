import { EventHandler } from "@navara/core";
import {
  SkyLightProbe as SkyLightProbeImpl,
  type PrecomputedTextures,
} from "@takram/three-atmosphere";
import { Vector3 } from "three";

export type SkyLightProbeEvents = {
  _needsUpdate: () => void;
};

// Add any specific options if needed in the future
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type SkyLightProbeOptions = {};

export class SkyLightProbe extends EventHandler<SkyLightProbeEvents> {
  raw: SkyLightProbeImpl;

  constructor(_options: SkyLightProbeOptions = {}) {
    super();

    this.raw = new SkyLightProbeImpl();
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

  update() {
    this.raw.update();
  }
}
