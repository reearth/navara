import { PolylineMesh as NavaraPolylineMesh } from "@navara/engine";

import { PolylineMesh } from "../../mesh";
import type { EventContext } from "../context";

export async function renderPolyline(
  ctx: EventContext,
  mesh: NavaraPolylineMesh,
  layerId: string,
) {
  return new PolylineMesh(mesh, ctx, layerId);
}

export function processPolylineChanged(
  obj: PolylineMesh,
  m: NavaraPolylineMesh,
  active: boolean,
) {
  obj._update(m.material, active);
}
