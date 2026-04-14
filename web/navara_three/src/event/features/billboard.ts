import type { BillboardMesh as NavaraBillboardMesh } from "@navara/engine";

import { InstancedSpriteMesh } from "../../mesh";
import { FEATURE_RENDER_ORDER } from "../../renderOrder";
import type { EventContext } from "../context";

export async function renderBillboard(
  ctx: EventContext,
  m: NavaraBillboardMesh,
) {
  if (!m.material.url) return;

  const mesh = new InstancedSpriteMesh({
    renderOrder: FEATURE_RENDER_ORDER,
    ctx,
  });
  await mesh._init(m);
  mesh.setActive(m.active);

  return mesh;
}

export async function processBillboardChanged(
  obj: InstancedSpriteMesh,
  m: NavaraBillboardMesh,
  active: boolean,
) {
  await obj._update(m);
  obj.setActive(active);
}
