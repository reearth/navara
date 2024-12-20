import type {
  PolylineGeometry,
  PolylineGeometryAttributes,
} from "@navara/engine";

import { PolylineGeometryAttributesLike } from "./PolylineGeometryAttributesLike";

export class PolylineGeometryLike implements PolylineGeometry {
  attributes: PolylineGeometryAttributesLike;
  indices: Uint32Array;

  constructor(t: PolylineGeometry) {
    this.attributes = new PolylineGeometryAttributesLike(
      t.transferAttributes(),
    );
    this.indices = t.transferIndices();
  }

  transferAttributes(): PolylineGeometryAttributes {
    throw new Error();
  }
  transferIndices(): Uint32Array {
    throw new Error();
  }

  free(): void {}
}
