import type {
  ConstructedPolylineGeometry,
  PolylineGeometry,
} from "@navara/engine";

import { ExtentRadianF32Like } from "../ExtentRadianF32Like";

import { PolylineGeometryLike } from "./PolylineGeometryLike";

export class ConstructedPolylineGeometryLike
  implements ConstructedPolylineGeometry
{
  extent: ExtentRadianF32Like;
  geometry: PolylineGeometryLike;

  constructor(t: ConstructedPolylineGeometry) {
    this.geometry = new PolylineGeometryLike(t.transferGeometry());
    this.extent = new ExtentRadianF32Like(t.extent);
  }

  transferGeometry(): PolylineGeometry {
    throw new Error();
  }

  free(): void {}
}
