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

  console.log("Rendering point as sprite mesh");
  // For testing, use InstancedSpriteMesh
  // TODO: choose based on some condition (instanced point vs instanced sprite (true gpu instancing or not))
  const mesh = new InstancedSpriteMesh(m, buf);
  return mesh;
}

export function processPointChanged(
  obj: InstancedPointMesh,
  m: NavaraPointMesh,
  buf: BufferLoader,
  active: boolean,
) {
  console.log("Processing point change");
  obj._update(m, buf, active);
}
