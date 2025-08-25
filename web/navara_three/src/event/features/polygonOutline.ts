import type { EventHandler } from "@navara/core";
import type { PolygonMesh as NavaraPolygonMesh } from "@navara/engine";
import type { ViewEvents } from "@navara/three";

import type { BufferLoader } from "../";
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
