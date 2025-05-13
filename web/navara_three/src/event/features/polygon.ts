import type {
  PolygonMesh as NavaraPolygonMesh,
  TileCoordinates,
} from "@navara/engine";

import type { BufferLoader } from "../";
import { PolygonMesh } from "../../mesh";
import type { CommonUniforms } from "../../uniforms";

export async function renderPolygon(
  mesh: NavaraPolygonMesh,
  buf: BufferLoader,
  uniforms: CommonUniforms,
  coords: TileCoordinates | undefined,
) {
  return new PolygonMesh(mesh, buf, uniforms, coords);
}

export function processPolygonChanged(
  obj: PolygonMesh,
  m: NavaraPolygonMesh,
  active: boolean,
  coords: TileCoordinates | undefined,
) {
  obj._update(m.material, active, !!coords);
}
