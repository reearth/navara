import { StarsGeometry, StarsMaterial } from "@takram/three-atmosphere";
import { Points, type Object3DEventMap } from "three";

import { STARS_ASSETS_URL } from "../constants";
import { STARS_RENDER_ORDER } from "../renderOrder";

export type StarsEvents = Object3DEventMap & {
  _needsUpdate: object;
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

export class Stars extends Points<StarsGeometry, StarsMaterial, StarsEvents> {
  options: Required<StarsOptions>;
  constructor(data: ArrayBuffer, options?: StarsOptions) {
    super(
      new StarsGeometry(data),
      new StarsMaterial({ depthTest: true, depthWrite: false }),
    );
    this.frustumCulled = false;
    this.renderOrder = STARS_RENDER_ORDER;
    this.options = { ...DEFAULT_STARS_OPTIONS, ...(options ?? {}) };

    this.material.pointSize = this.options.pointSize;
    this.material.radianceScale = this.options.radianceScale;
    this.material.background = this.options.background;
  }

  static async fromUrl(url = STARS_ASSETS_URL, options?: StarsOptions) {
    const arrayBuffer = await fetch(url)
      .then((r) => r.arrayBuffer())
      .catch(console.error);
    if (!arrayBuffer) return;
    return new Stars(arrayBuffer, options);
  }

  get pointSize() {
    return this.options.pointSize;
  }
  set pointSize(v: number) {
    this.options.pointSize = v;
    this.material.pointSize = v;
    this.dispatchEvent({ type: "_needsUpdate" });
  }

  get radianceScale() {
    return this.options.radianceScale;
  }
  set radianceScale(v: number) {
    this.options.radianceScale = v;
    this.material.radianceScale = v;
    this.dispatchEvent({ type: "_needsUpdate" });
  }

  get background() {
    return this.options.background;
  }
  set background(v: boolean) {
    this.options.background = v;
    this.material.background = v;
    this.dispatchEvent({ type: "_needsUpdate" });
  }
}
