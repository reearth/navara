import {
  PolylineMesh as NavaraPolylineMesh,
  type PolylineMaterial,
} from "@navara/engine";

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
  material: PolylineMaterial,
  active: boolean,
) {
  obj._update(material, active);
}
