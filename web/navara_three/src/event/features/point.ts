import { PointMesh as NavaraPointMesh } from "@navara/engine";

import type { BufferLoader } from "..";
import { InstancedPointMesh } from "../../mesh";
import type { CommonUniforms } from "../../uniforms";

export async function renderPoint(
  m: NavaraPointMesh,
  buf: BufferLoader,
  uniforms: CommonUniforms,
) {
  return new InstancedPointMesh(m, buf, uniforms, { renderOrder: 1 });
}

export function processPointChanged(
  obj: InstancedPointMesh,
  m: NavaraPointMesh,
  buf: BufferLoader,
  active: boolean,
) {
  obj._update(m, buf, active);
}
