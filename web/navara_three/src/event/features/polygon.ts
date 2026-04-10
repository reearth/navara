import type { TileHandle } from "@navara/core";
import type { PolygonMesh as NavaraPolygonMesh } from "@navara/engine";

import type { BufferLoader } from "../";
import type { ViewContext } from "../../core";
import { PolygonMesh } from "../../mesh";
import type { CommonUniforms } from "../../uniforms";

export async function renderPolygon(
  mesh: NavaraPolygonMesh,
  buf: BufferLoader,
  uniforms: CommonUniforms,
  tileHandle: TileHandle | undefined,
  viewContext: ViewContext,
) {
  return new PolygonMesh(viewContext, uniforms).init(
    mesh,
    buf,
    tileHandle,
  );
}

export function processPolygonChanged(
  obj: PolygonMesh,
  m: NavaraPolygonMesh,
  active: boolean,
  tileHandle: TileHandle | undefined,
) {
  obj._update(m.material, active, !!tileHandle);
}
