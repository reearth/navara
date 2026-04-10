import type { TileHandle } from "@navara/core";
import type { PolygonMesh as NavaraPolygonMesh } from "@navara/engine";

import { PolygonMesh } from "../../mesh";
import type { EventContext } from "../context";

export async function renderPolygon(
  ctx: EventContext,
  mesh: NavaraPolygonMesh,
  tileHandle: TileHandle | undefined,
  layerId: string,
) {
  return new PolygonMesh(ctx, layerId).init(mesh, tileHandle);
}

export function processPolygonChanged(
  obj: PolygonMesh,
  m: NavaraPolygonMesh,
  active: boolean,
  tileHandle: TileHandle | undefined,
) {
  obj._update(m.material, active, !!tileHandle);
}
