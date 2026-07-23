import type { TileHandle } from "@navaramap/core";
import type { PolygonMesh as NavaraPolygonMesh } from "@navaramap/engine";

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
  // `!= null`, not truthiness: the root vector tile's handle is 0.
  obj._update(m.material, active, tileHandle != null);
}
