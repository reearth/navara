import { PointMesh as NavaraPointMesh } from "@navara/engine";

import type { BufferLoader } from "..";
import type { ViewContext } from "../../core";
import { InstancedPointMesh, InstancedSpriteMesh } from "../../mesh";
import { FEATURE_RENDER_ORDER } from "../../renderOrder";

export async function renderPoint(
  m: NavaraPointMesh,
  buf: BufferLoader,
  viewContext: ViewContext,
  layerId: string,
) {
  // const mesh = new InstancedPointMesh(m, buf, {
  //   renderOrder: FEATURE_RENDER_ORDER,
  //   viewContext,
  //   layerId,
  // });
  // return mesh;

  // For testing, use InstancedSpriteMesh
  // TODO: choose based on some condition (instanced point vs instanced sprite (true gpu instancing or not))
  const mesh = new InstancedSpriteMesh({
    renderOrder: FEATURE_RENDER_ORDER,
    viewContext,
    layerId,
  });
  await mesh._init(m, buf);
  console.log("Created InstancedSpriteMesh for point feature");
  return mesh;
}

export function processPointChanged(
  obj: InstancedSpriteMesh,
  m: NavaraPointMesh,
  buf: BufferLoader,
  active: boolean,
) {
  obj._update(m , active);
}
