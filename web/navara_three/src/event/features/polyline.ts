import type { EventHandler } from "@navara/core";
import { PolylineMesh as NavaraPolylineMesh } from "@navara/engine";

import type { BufferLoader } from "../";
import type { ViewEvents } from "../..";
import type { ViewContext } from "../../core";
import { PolylineMesh } from "../../mesh";
import type { CommonUniforms } from "../../uniforms";

export async function renderPolyline(
  mesh: NavaraPolylineMesh,
  buf: BufferLoader,
  uniforms: CommonUniforms,
  viewEvents: EventHandler<ViewEvents>,
  viewContext: ViewContext,
  layerId: string,
) {
  const polylineMesh = new PolylineMesh(
    mesh,
    buf,
    uniforms,
    viewEvents,
    viewContext,
    layerId,
  );
  return polylineMesh;
}

export function processPolylineChanged(
  obj: PolylineMesh,
  m: NavaraPolylineMesh,
  active: boolean,
) {
  obj._update(m.material, active);
}
