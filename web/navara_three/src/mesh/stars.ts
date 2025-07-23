import { EventHandler } from "@navara/core";
import {
  StarsGeometry,
  StarsMaterial,
  type PrecomputedTextures,
} from "@takram/three-atmosphere";
import { Points, Matrix4, Vector3 } from "three";

import { STARS_ASSETS_URL } from "../constants";
import { STARS_RENDER_ORDER } from "../renderOrder";

export type StarsEvents = {
  _needsUpdate: () => void;
};

export type StarsOptions = {
  pointSize?: number;
  radianceScale?: number;
  background?: boolean;
};

export const DEFAULT_STARS_OPTIONS: Required<StarsOptions> = {
  pointSize: 1,
  radianceScale: 10,
  background: true,
};

export class Stars extends EventHandler<StarsEvents> {
  raw: Points<StarsGeometry, StarsMaterial>;
  options: Required<StarsOptions>;

  constructor(data: ArrayBuffer, options?: StarsOptions) {
    super();
    this.raw = new Points(
      new StarsGeometry(data),
      new StarsMaterial({ depthTest: true, depthWrite: false }),
    );
    this.raw.frustumCulled = false;
    this.raw.renderOrder = STARS_RENDER_ORDER;
    this.options = { ...DEFAULT_STARS_OPTIONS, ...(options ?? {}) };

    this.raw.material.pointSize = this.options.pointSize;
    this.raw.material.radianceScale = this.options.radianceScale;
    this.raw.material.background = this.options.background;
  }

  static async fromUrl(url = STARS_ASSETS_URL, options?: StarsOptions) {
    const arrayBuffer = await fetch(url)
      .then((r) => r.arrayBuffer())
      .catch(console.error);
    if (!arrayBuffer) return;
    return new Stars(arrayBuffer, options);
  }

  setTextures(textures: PrecomputedTextures) {
    Object.assign(this.raw.material, textures);
  }

  setRotationFromMatrix(matrix: Matrix4) {
    this.raw.setRotationFromMatrix(matrix);
  }

  updateSunDirection(sunDirection: Vector3) {
    this.raw.material.sunDirection.copy(sunDirection);
  }

  get pointSize() {
    return this.options.pointSize;
  }
  set pointSize(v: number) {
    this.options.pointSize = v;
    this.raw.material.pointSize = v;
    this.emit("_needsUpdate");
  }

  get radianceScale() {
    return this.options.radianceScale;
  }
  set radianceScale(v: number) {
    this.options.radianceScale = v;
    this.raw.material.radianceScale = v;
    this.emit("_needsUpdate");
  }

  get background() {
    return this.options.background;
  }
  set background(v: boolean) {
    this.options.background = v;
    this.raw.material.background = v;
    this.emit("_needsUpdate");
  }
}
