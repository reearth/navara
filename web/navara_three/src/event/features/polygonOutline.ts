import type { PolygonMesh as NavaraPolygonMesh } from "@navara/engine";

import { PolygonOutlineMesh } from "../../mesh";
import type { EventContext } from "../context";

export async function renderPolygonOutline(
  ctx: EventContext,
  mesh: NavaraPolygonMesh,
) {
  return new PolygonOutlineMesh(ctx, mesh);
}

export function processPolygonOutlineChanged(
  obj: PolygonOutlineMesh,
  m: NavaraPolygonMesh,
  active: boolean,
) {
  obj._update(m.material, active);
}
