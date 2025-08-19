import type { PolygonMesh as NavaraPolygonMesh } from "@navara/engine";

import type { BufferLoader } from "../";
import { PolygonOutlineMesh } from "../../mesh";
import type { EventHandler } from "@navara/core";
import type { ViewEvents } from "@navara/three";

export async function renderPolygonOutline(
  mesh: NavaraPolygonMesh,
  buf: BufferLoader,
  viewEvents: EventHandler<ViewEvents>,
) {
  // console.log(mesh.outline_geometry?.position);
  return new PolygonOutlineMesh(mesh, buf, viewEvents);
}

export function processPolygonOutlineChanged(
  obj: PolygonOutlineMesh,
  m: NavaraPolygonMesh,
  active: boolean,
) {
  obj._update(m.material, active);
}
