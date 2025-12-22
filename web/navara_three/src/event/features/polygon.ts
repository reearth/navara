import type { EventHandler, TileHandle } from "@navara/core";
import type { PolygonMesh as NavaraPolygonMesh } from "@navara/engine";

import type { BufferLoader } from "../";
import type { ViewEvents } from "../..";
import { PolygonMesh } from "../../mesh";
import type { TextureOptions } from "../../textures";
import type { CommonUniforms } from "../../uniforms";

export async function renderPolygon(
  mesh: NavaraPolygonMesh,
  buf: BufferLoader,
  uniforms: CommonUniforms,
  tileHandle: TileHandle | undefined,
  viewEvents: EventHandler<ViewEvents>,
  textureOptions: TextureOptions,
) {
  return new PolygonMesh().init(
    mesh,
    buf,
    uniforms,
    tileHandle,
    viewEvents,
    textureOptions,
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
