import type { Vec3 } from "@navara/engine";

export class Vec3Like implements Vec3 {
  x: number;
  y: number;
  z: number;

  constructor(t: Vec3) {
    this.x = t.x;
    this.y = t.y;
    this.z = t.z;
  }

  free(): void {}
}
