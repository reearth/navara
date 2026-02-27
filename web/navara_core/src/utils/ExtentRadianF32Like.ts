import type { ExtentRadianF32 } from "@navara/engine";

import type { RemoveFreeRecursively } from "../types";

export class ExtentRadianF32Like implements RemoveFreeRecursively<ExtentRadianF32> {
  east: number;
  north: number;
  south: number;
  west: number;

  constructor(t: ExtentRadianF32) {
    this.east = t.east;
    this.north = t.north;
    this.south = t.south;
    this.west = t.west;
  }
}
