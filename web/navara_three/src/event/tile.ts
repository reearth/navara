import { generate_id_from_entity } from "@navara/core";
import { type MeshAdded, MeshChanged } from "@navara/engine";
import { Texture } from "three";

import type { ViewContext } from "../core";
import { TileMesh } from "../mesh";
import type { Scenes, TexturizedSceneByTileCoordinates } from "../scene";
import type { TextureOptions } from "../textures";
import type { MeshCache, TileMapByHandle } from "../type";
import type { CommonUniforms } from "../uniforms";

import type { BufferLoader, TileHandler } from ".";
import type { TextureSlot } from "../utils";

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
  textureFragmentIndex: Map<string, Set<TextureSlot>>,
  tileMeshToFragmentIds: Map<TileMesh, Set<string>>,
  viewContext: ViewContext,
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
    textureFragmentIndex,
    tileMeshToFragmentIds,
    viewContext,
    uniforms,
  );
}

export function processMeshChanged(
  meshes: MeshCache,
  mesh: MeshChanged,
  loadedTexes: Map<string, Texture>,
  textureOptions: TextureOptions,
  tileMapByHandle: TileMapByHandle,
  textureFragmentIndex: Map<string, Set<TextureSlot>>,
  tileMeshToFragmentIds: Map<TileMesh, Set<string>>,
) {
  const id = generate_id_from_entity(mesh);
  const m = meshes.get(id);
  if (!m || !(m instanceof TileMesh)) return;

  m._update(
    mesh,
    loadedTexes,
    textureOptions,
    tileMapByHandle,
    textureFragmentIndex,
    tileMeshToFragmentIds,
    mesh.globe,
  );
}
