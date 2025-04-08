import type {
  PolygonMesh as NavaraPolygonMesh,
  PolygonMaterial,
} from "@navara/engine";

import type { BufferLoader } from "../";
import { PolygonMesh } from "../../mesh";
import type { CommonUniforms } from "../../uniforms";

export async function renderPolygon(
  mesh: NavaraPolygonMesh,
  buf: BufferLoader,
  uniforms: CommonUniforms,
) {
  return new PolygonMesh(mesh, buf, uniforms);
}

export function processPolygonChanged(
  obj: PolygonMesh,
  material: PolygonMaterial,
  active: boolean,
) {
  obj._update(material, active);
}
