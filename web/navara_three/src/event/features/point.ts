import { PointMesh as NavaraPointMesh } from "@navara/engine";

import type { BufferLoader } from "..";
import type { ViewContext } from "../../core";
import { InstancedSpriteMesh } from "../../mesh";
import { FEATURE_RENDER_ORDER } from "../../renderOrder";

export async function renderPoint(
  m: NavaraPointMesh,
  buf: BufferLoader,
  viewContext: ViewContext,
  layerId: string,
) {
  const mesh = new InstancedSpriteMesh({
    renderOrder: FEATURE_RENDER_ORDER,
    viewContext,
    layerId,
  });
  await mesh._init(m, buf);

  return mesh;
}

export function processPointChanged(
  obj: InstancedSpriteMesh,
  m: NavaraPointMesh,
  buf: BufferLoader,
) {
  obj._update(m, buf);
}
