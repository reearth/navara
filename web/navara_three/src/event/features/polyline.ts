import { PolylineMesh as NavaraPolylineMesh } from "@navara/engine";

import type { BufferLoader } from "../";
import { PolylineMesh } from "../../mesh";
import type { CommonUniforms } from "../../uniforms";

export async function renderPolyline(
  mesh: NavaraPolylineMesh,
  buf: BufferLoader,
  uniforms: CommonUniforms,
) {
  return new PolylineMesh(mesh, buf, uniforms);
}

export function processPolylineChanged(
  obj: PolylineMesh,
  m: NavaraPolylineMesh,
  active: boolean,
) {
  obj._update(m.material, active);
}
