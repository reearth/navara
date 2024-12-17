import type {
  ConstructedPolygonGeometry,
  PolygonGeometry,
} from "@navara/engine";

import { ExtentRadianF32Like } from "../ExtentRadianF32Like";

import { PolygonGeometryLike } from "./PolygonGeometryLike";

export class ConstructedPolygonGeometryLike
  implements ConstructedPolygonGeometry
{
  extent: ExtentRadianF32Like;
  geometry: PolygonGeometryLike;

  constructor(t: ConstructedPolygonGeometry) {
    this.geometry = new PolygonGeometryLike(t.transferGeometry());
    this.extent = new ExtentRadianF32Like(t.extent);
  }

  transferGeometry(): PolygonGeometry {
    throw new Error();
  }

  free(): void {}
}
