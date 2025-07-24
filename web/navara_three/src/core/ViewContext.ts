import type { Camera } from "three";

import type { Atmosphere } from "../atmosphere";
import type { Scenes } from "../scene";

// Restrict public API for a layer declaration.
export class ViewContext {
  constructor(
    public scenes: Scenes,
    public camera: Camera,
    public atmosphere: Atmosphere,
  ) {}

  setCamera(camera: Camera) {
    this.camera = camera;
  }
}
