import type { BillboardMesh as NavaraBillboardMesh } from "@navara/engine";

import type { BufferLoader } from "..";
import type { ViewContext } from "../../core";
import { InstancedBillboardMesh } from "../../mesh";
import { FEATURE_RENDER_ORDER } from "../../renderOrder";

export async function renderBillboard(
  m: NavaraBillboardMesh,
  buf: BufferLoader,
  viewContext: ViewContext,
  layerId: string,
) {
  if (!m.material.url) return;

  const mesh = new InstancedBillboardMesh({
    renderOrder: FEATURE_RENDER_ORDER,
  });
  mesh.userData.viewContext = viewContext;
  mesh.userData.layerId = layerId;
  await mesh._init(m, buf);

  return mesh;
}

export async function processBillboardChanged(
  obj: InstancedBillboardMesh,
  m: NavaraBillboardMesh,
  buf: BufferLoader,
  active: boolean,
) {
  await obj._update(m, buf, active);
}
