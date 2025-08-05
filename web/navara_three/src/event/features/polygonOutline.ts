import type { PolygonMesh as NavaraPolygonMesh } from "@navara/engine";

import type { BufferLoader } from "../";
import { PolygonOutlineMesh } from "../../mesh";

export async function renderPolygonOutline(
  mesh: NavaraPolygonMesh,
  buf: BufferLoader,
) {
  // console.log(mesh.outline_geometry?.position);
  return new PolygonOutlineMesh(mesh, buf);
}

export function processPolygonOutlineChanged(
  obj: PolygonOutlineMesh,
  m: NavaraPolygonMesh,
  active: boolean,
) {
  obj._update(m.material, active);
}
