import { PointMesh as NavaraPointMesh } from "@navara/engine";

import { InstancedSpriteMesh } from "../../mesh";
import { FEATURE_RENDER_ORDER } from "../../renderOrder";
import type { EventContext } from "../context";

export async function renderPoint(
  ctx: EventContext,
  m: NavaraPointMesh,
  layerId: string,
) {
  const mesh = new InstancedSpriteMesh({
    renderOrder: FEATURE_RENDER_ORDER,
    ctx,
    layerId,
  });
  await mesh._init(m);
  mesh.setActive(m.active);

  return mesh;
}

export function processPointChanged(
  obj: InstancedSpriteMesh,
  m: NavaraPointMesh,
  active: boolean,
) {
  obj._update(m);
  obj.setActive(active);
}
