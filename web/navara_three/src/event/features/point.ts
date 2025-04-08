import {
  PointMesh as NavaraPointMesh,
  type PointMaterial,
} from "@navara/engine";

import { PointMesh } from "../../mesh/point";
import type { CommonUniforms } from "../../uniforms";

export async function renderPoint(
  m: NavaraPointMesh,
  uniforms: CommonUniforms,
) {
  return new PointMesh(m, uniforms);
}

export function processPointChanged(
  obj: PointMesh,
  material: PointMaterial,
  active: boolean,
) {
  obj._update(material, active);
}
