import type {
  BillboardMesh as NavaraBillboardMesh,
  BillboardMaterial,
} from "@navara/engine";

import { BillboardMesh } from "../../mesh";
import type { CommonUniforms } from "../../uniforms";

export async function renderBillboard(
  m: NavaraBillboardMesh,
  uniforms: CommonUniforms,
) {
  if (!m.material.url) return;

  const mesh = new BillboardMesh();
  await mesh._init(m, uniforms);

  return mesh;
}

export async function processBillboardChanged(
  obj: BillboardMesh,
  material: BillboardMaterial,
  active: boolean,
) {
  await obj._update(material, active);
}
