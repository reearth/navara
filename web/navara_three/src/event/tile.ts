import { generate_id_from_entity } from "@navara/core";
import type { EventHandler } from "@navara/core";
import { type MeshAdded, MeshChanged } from "@navara/engine";
import { Texture } from "three";

import type { ViewEvents } from "..";
import { TileMesh } from "../mesh";
import type { Scenes, TexturizedSceneByTileCoordinates } from "../scene";
import type { TextureOptions } from "../textures";
import type { MeshCache, TileMapByHandle } from "../type";
import type { CommonUniforms } from "../uniforms";

import type { BufferLoader, TileHandler } from ".";

export async function processMeshAdded(
  scenes: Scenes,
  meshes: MeshCache,
  mesh: MeshAdded,
  buf: BufferLoader,
  tileHandler: TileHandler,
  loadedTexes: Map<string, Texture>,
  textureOptions: TextureOptions,
  texturizedSceneByTileCoordinates: TexturizedSceneByTileCoordinates,
  tileMapByHandle: TileMapByHandle,
  viewEvents: EventHandler<ViewEvents>,
  uniforms: CommonUniforms,
) {
  const m = new TileMesh(
    mesh,
    texturizedSceneByTileCoordinates,
    textureOptions,
    tileMapByHandle,
    tileHandler,
  );
  await m._init(
    scenes,
    meshes,
    mesh,
    buf,
    loadedTexes,
    textureOptions,
    tileMapByHandle,
    viewEvents,
    uniforms,
  );
}

export function processMeshChanged(
  meshes: MeshCache,
  mesh: MeshChanged,
  loadedTexes: Map<string, Texture>,
  textureOptions: TextureOptions,
  tileMapByHandle: TileMapByHandle,
) {
  const id = generate_id_from_entity(mesh);
  const m = meshes.get(id);
  if (!m || !(m instanceof TileMesh)) return;

  m._update(mesh, loadedTexes, textureOptions, tileMapByHandle);
}
