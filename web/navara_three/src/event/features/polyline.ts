import type { EventHandler } from "@navara/core";
import { PolylineMesh as NavaraPolylineMesh } from "@navara/engine";
import type { ViewEvents } from "@navara/three";

import type { BufferLoader } from "../";
import { PolylineMesh } from "../../mesh";
import type { CommonUniforms } from "../../uniforms";

export async function renderPolyline(
  mesh: NavaraPolylineMesh,
  buf: BufferLoader,
  uniforms: CommonUniforms,
  viewEvents: EventHandler<ViewEvents>,
) {
  return new PolylineMesh(mesh, buf, uniforms, viewEvents);
}

export function processPolylineChanged(
  obj: PolylineMesh,
  m: NavaraPolylineMesh,
  active: boolean,
) {
  obj._update(m.material, active);
}
