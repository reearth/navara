import type {
  PolygonGeometry,
  PolygonGeometryAttributes,
} from "@navara/engine";

import { PolygonGeometryAttributesLike } from "./PolygonGeometryAttributesLike";

export class PolygonGeometryLike implements PolygonGeometry {
  attributes: PolygonGeometryAttributesLike;
  indices: Uint32Array;

  constructor(t: PolygonGeometry) {
    this.attributes = new PolygonGeometryAttributesLike(t.transferAttributes());
    this.indices = t.transferIndices();
  }

  transferAttributes(): PolygonGeometryAttributes {
    throw new Error();
  }
  transferIndices(): Uint32Array {
    throw new Error();
  }

  free(): void {}
}
