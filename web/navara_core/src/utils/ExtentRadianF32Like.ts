import type { ExtentRadianF32 } from "@navara/engine";

export class ExtentRadianF32Like implements ExtentRadianF32 {
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

  free(): void {}
}
