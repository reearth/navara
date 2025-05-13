import { generate_id_from_entity } from "@navara/core";
import { type MeshAdded, MeshChanged } from "@navara/engine";
import { Texture } from "three";

import { TileMesh } from "../mesh";
import type { Scenes, TexturizedSceneByTileCoordinates } from "../scene";
import type { TextureOptions } from "../textures";
import type { MeshCache } from "../type";

import type { BufferLoader } from ".";

export async function processMeshAdded(
  scenes: Scenes,
  meshes: MeshCache,
  mesh: MeshAdded,
  buf: BufferLoader,
  loadedTexes: Map<string, Texture>,
  textureOptions: TextureOptions,
  texturizedSceneByTileCoordinates: TexturizedSceneByTileCoordinates,
) {
  const m = new TileMesh(mesh, texturizedSceneByTileCoordinates);
  await m._init(scenes, meshes, mesh, buf, loadedTexes, textureOptions);
}

export function processMeshChanged(
  meshes: MeshCache,
  mesh: MeshChanged,
  loadedTexes: Map<string, Texture>,
  textureOptions: TextureOptions,
) {
  const id = generate_id_from_entity(mesh);
  const m = meshes.get(id);
  if (!m || !(m instanceof TileMesh)) return;

  m._update(mesh, loadedTexes, textureOptions);
}
