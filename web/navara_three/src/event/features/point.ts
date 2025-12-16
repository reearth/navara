import { PointMesh as NavaraPointMesh } from "@navara/engine";

import type { BufferLoader } from "..";
import type { ViewContext } from "../../core";
import { InstancedPointMesh } from "../../mesh";
import { FEATURE_RENDER_ORDER } from "../../renderOrder";

export async function renderPoint(
  m: NavaraPointMesh,
  buf: BufferLoader,
  viewContext: ViewContext,
  layerId: string,
) {
  const mesh = new InstancedPointMesh(m, buf, {
    renderOrder: FEATURE_RENDER_ORDER,
  });
  mesh.setPostEffectContext(viewContext, layerId);
  return mesh;
}

export function processPointChanged(
  obj: InstancedPointMesh,
  m: NavaraPointMesh,
  buf: BufferLoader,
  active: boolean,
) {
  obj._update(m, buf, active);
}
