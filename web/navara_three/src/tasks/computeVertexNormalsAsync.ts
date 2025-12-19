import { type BufferGeometry } from "three";

import { fromBufferGeometryLike, toBufferGeometryLike } from "../utils";

import { queueTask } from "./queueTask";

export async function computeVertexNormalsAsync(
  geometry: BufferGeometry,
): Promise<BufferGeometry> {
  const [geometryLike, transfer] = toBufferGeometryLike(geometry);
  const result = await queueTask("computeVertexNormals", [geometryLike], {
    transfer,
  });
  return fromBufferGeometryLike(result, geometry);
}
