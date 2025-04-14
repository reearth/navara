import type { BillboardMesh as NavaraBillboardMesh } from "@navara/engine";

import type { BufferLoader } from "..";
import { InstancedBillboardMesh } from "../../mesh";
import type { CommonUniforms } from "../../uniforms";

export async function renderBillboard(
  m: NavaraBillboardMesh,
  buf: BufferLoader,
  uniforms: CommonUniforms,
) {
  if (!m.material.url) return;

  const mesh = new InstancedBillboardMesh({ renderOrder: 1 });
  await mesh._init(m, buf, uniforms);

  return mesh;
}

export async function processBillboardChanged(
  obj: InstancedBillboardMesh,
  m: NavaraBillboardMesh,
  buf: BufferLoader,
  active: boolean,
) {
  await obj._update(m, buf, active);
}
