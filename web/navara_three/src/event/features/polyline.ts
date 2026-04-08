import { PolylineMesh as NavaraPolylineMesh } from "@navara/engine";

import type { BufferLoader } from "../";
import type { ViewContext } from "../../core";
import { PolylineMesh } from "../../mesh";
import type { CommonUniforms } from "../../uniforms";

export async function renderPolyline(
  mesh: NavaraPolylineMesh,
  buf: BufferLoader,
  uniforms: CommonUniforms,
  viewContext: ViewContext,
) {
  const polylineMesh = new PolylineMesh(mesh, buf, uniforms, viewContext);
  return polylineMesh;
}

export function processPolylineChanged(
  obj: PolylineMesh,
  m: NavaraPolylineMesh,
  active: boolean,
) {
  obj._update(m.material, active);
}
