import { PointMesh as NavaraPointMesh } from "@navara/engine";

import type { BufferLoader } from "..";
import { InstancedPointMesh } from "../../mesh";
import { FEATURE_RENDER_ORDER } from "../../renderOrder";
import type { CommonUniforms } from "../../uniforms";

export async function renderPoint(
  m: NavaraPointMesh,
  buf: BufferLoader,
  uniforms: CommonUniforms,
) {
  return new InstancedPointMesh(m, buf, uniforms, {
    renderOrder: FEATURE_RENDER_ORDER,
  });
}

export function processPointChanged(
  obj: InstancedPointMesh,
  m: NavaraPointMesh,
  buf: BufferLoader,
  active: boolean,
) {
  obj._update(m, buf, active);
}
