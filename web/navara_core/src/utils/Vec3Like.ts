import type { Vec3 } from "@navara/engine";

import type { RemoveFreeRecursively } from "../types";

export class Vec3Like implements RemoveFreeRecursively<Vec3> {
  x: number;
  y: number;
  z: number;

  constructor(t: Vec3) {
    this.x = t.x;
    this.y = t.y;
    this.z = t.z;
  }
}
