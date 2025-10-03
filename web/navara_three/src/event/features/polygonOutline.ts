import type { EventHandler } from "@navara/core";
import type { PolygonMesh as NavaraPolygonMesh } from "@navara/engine";

import type { BufferLoader } from "../";
import type { ViewEvents } from "../..";
import { PolygonOutlineMesh } from "../../mesh";

export async function renderPolygonOutline(
  mesh: NavaraPolygonMesh,
  buf: BufferLoader,
  viewEvents: EventHandler<ViewEvents>,
) {
  return new PolygonOutlineMesh(mesh, buf, viewEvents);
}

export function processPolygonOutlineChanged(
  obj: PolygonOutlineMesh,
  m: NavaraPolygonMesh,
  active: boolean,
) {
  obj._update(m.material, active);
}
