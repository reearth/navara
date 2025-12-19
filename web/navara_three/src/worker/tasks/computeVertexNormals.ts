import { transfer } from "@navara/worker";

import {
  fromBufferGeometryLike,
  toBufferGeometryLike,
  type BufferGeometryLike,
} from "../../utils";

// TODO: Compute this in Rust.
export function computeVertexNormals(input: BufferGeometryLike) {
  const geometry = fromBufferGeometryLike(input);
  geometry.computeVertexNormals();
  const [geometryLike, transferObj] = toBufferGeometryLike(geometry);
  return transfer(geometryLike, transferObj);
}
