import { EventHandler } from "@navara/core";
import { AmbientLight, Color } from "three";

export type AmbientLightEvents = {
  _needsUpdate: () => void;
};

export type AmbientLightOptions = {
  color?: Color;
  intensity?: number;
};

const DEFAULT_AMBIENT_LIGHT_OPTIONS: Required<AmbientLightOptions> = {
  color: new Color(0xffffff),
  intensity: 1,
};

export class AtmosphereAmbientLight extends EventHandler<AmbientLightEvents> {
  raw: AmbientLight;
  private options: AmbientLightOptions;

  constructor(options: AmbientLightOptions = {}) {
    super();

    this.options = { ...DEFAULT_AMBIENT_LIGHT_OPTIONS, ...options };

    this.raw = new AmbientLight(this.options.color, this.options.intensity);
  }

  get color() {
    return this.raw.color;
  }
  set color(v: Color) {
    this.raw.color.copy(v);
    this.emit("_needsUpdate");
  }

  get intensity() {
    return this.raw.intensity;
  }
  set intensity(v: number) {
    this.raw.intensity = v;
    this.emit("_needsUpdate");
  }
}
