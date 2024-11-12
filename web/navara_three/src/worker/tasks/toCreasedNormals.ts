// Ref: https://github.com/takram-design-engineering/geovanni/blob/ee91f675ba2558ee3099f635dfa30bbe3adfe103/libs/3d-tiles/src/toCreasedNormalsAsync.ts

/* eslint-env worker */

import { transfer } from "@navara/worker";
import { toCreasedNormals as toCreasedNormalsImpl } from "three-stdlib";

import {
  fromBufferGeometryLike,
  toBufferGeometryLike,
  type BufferGeometryLike,
} from "../../utils";

export function toCreasedNormals(
  input: BufferGeometryLike,
  creaseAngle?: number,
) {
  const [geometryLike, transferObj] = toBufferGeometryLike(
    toCreasedNormalsImpl(fromBufferGeometryLike(input), creaseAngle),
  );
  return transfer(geometryLike, transferObj);
}
