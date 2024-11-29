import { TransferableMartiniLike } from "@navara/core";
import {
  ConstructTerrainMeshParameters,
  ConstructTerrainMeshResult,
  DelegatedWorkerTasksResult,
  ReconstructableEntity,
  TransferableGeometry,
  TransferableRasterDEMData,
  UpsamplableTerrainGeometry,
  UpsampleTerrainMeshParameters,
  UpsampleTerrainMeshResult,
  type WorkerTaskDelegatedEvent,
} from "@navara/engine";

import { constructTerrainMesh } from "../tasks/constructTerrainMesh";
import { upsampleTerrainMesh } from "../tasks/upsampleTerrainMesh";
import type { MartiniCache } from "../type";

import type { BufferLoader, TileHandler, WorkerTaskHandler } from ".";

export async function processWorkerTaskDelegatedEvent(
  event: WorkerTaskDelegatedEvent,
  bufHandler: BufferLoader,
  tileHandler: TileHandler,
  workerTaskHandler: WorkerTaskHandler,
  martiniCache: MartiniCache,
) {
  if (event.task.construct_terrain_mesh) {
    return await processConstructTerrainMesh(
      event.bits,
      event.task.construct_terrain_mesh,
      event.task.delegator_id,
      bufHandler,
      tileHandler,
      workerTaskHandler,
      martiniCache,
    );
  }
  if (event.task.upsample_terrain_mesh) {
    return await processUpsampleTerrainMesh(
      event.bits,
      event.task.upsample_terrain_mesh,
      event.task.delegator_id,
      bufHandler,
      tileHandler,
      workerTaskHandler,
    );
  }
}

async function processConstructTerrainMesh(
  bits: bigint,
  params: ConstructTerrainMeshParameters,
  delegator_id: ReconstructableEntity,
  bufHandler: BufferLoader,
  tileHandler: TileHandler,
  workerTaskHandler: WorkerTaskHandler,
  martiniCache: MartiniCache,
) {
  const bytes = bufHandler.u8(params.bytes_handle);
  if (!bytes) {
    return;
  }

  const martiniId = params.martini_id[0];
  const cachedMartini = martiniCache.get(martiniId);
  const martini = (() => {
    if (cachedMartini) {
      return cachedMartini;
    }
    const martini = tileHandler.getMartini(params.martini_id);
    if (!martini) return;
    const martiniLike = new TransferableMartiniLike(martini);
    martiniCache.set(martiniId, martiniLike);
    return martiniLike;
  })();
  if (!martini) {
    return;
  }
  const tile = tileHandler.getTile(params.tile_handle);
  if (!tile) {
    return;
  }
  const elevationDecoder = tileHandler.getTileElevationDecoder(
    params.tile_handle,
  );
  if (!elevationDecoder) {
    return;
  }
  const result = await constructTerrainMesh(
    bytes,
    tile,
    new TransferableRasterDEMData(elevationDecoder),
    martini,
  );

  const vertices = bufHandler.newF32(result.geometry.vertices);
  const uvs = bufHandler.newF32(result.geometry.uvs);
  const indices = bufHandler.newU32(result.geometry.indices);
  const heights = bufHandler.newF32(result.heights);
  if (!vertices || !uvs || !indices || !heights) {
    return;
  }

  const geometry = new TransferableGeometry(vertices, uvs, indices);

  const constructTerrainMeshResult = new ConstructTerrainMeshResult(
    geometry,
    heights,
    result.min_height,
    result.max_height,
  );

  const delegatedTaskResult = new DelegatedWorkerTasksResult(
    delegator_id,
    constructTerrainMeshResult,
  );

  workerTaskHandler.triggerWorkerTaskCompleted(bits, delegatedTaskResult);
}

async function processUpsampleTerrainMesh(
  bits: bigint,
  params: UpsampleTerrainMeshParameters,
  delegator_id: ReconstructableEntity,
  bufHandler: BufferLoader,
  tileHandler: TileHandler,
  workerTaskHandler: WorkerTaskHandler,
) {
  const tile = tileHandler.getTile(params.tile_handle);
  if (!tile) {
    return;
  }
  const parentTile = tileHandler.getParentTile(params.tile_handle);
  if (!parentTile) {
    return;
  }

  const cachedMeshHandle = parentTile.cached_mesh_handle;
  if (!cachedMeshHandle || !cachedMeshHandle.heights) {
    return;
  }

  const parentUvs = bufHandler.f32(cachedMeshHandle.uvs);
  const parentIndices = bufHandler.u32(cachedMeshHandle.indices);
  const parentHeights = bufHandler.f32(cachedMeshHandle.heights);
  if (!parentUvs || !parentIndices || !parentHeights) {
    return;
  }

  const elevationDecoder = tileHandler.getTileElevationDecoder(
    params.tile_handle,
  );
  if (!elevationDecoder) {
    return;
  }

  const upsamplableTerrainGeometry = new UpsamplableTerrainGeometry(
    parentUvs,
    parentIndices,
    parentHeights,
  );

  const result = await upsampleTerrainMesh(
    tile,
    parentTile,
    new TransferableRasterDEMData(elevationDecoder),
    upsamplableTerrainGeometry,
  );

  const vertices = bufHandler.newF32(result.geometry.vertices);
  const uvs = bufHandler.newF32(result.geometry.uvs);
  const indices = bufHandler.newU32(result.geometry.indices);
  const heights = bufHandler.newF32(result.heights);
  if (!vertices || !uvs || !indices || !heights) {
    return;
  }

  const geometry = new TransferableGeometry(vertices, uvs, indices);

  const upsampleTerrainMeshResult = new UpsampleTerrainMeshResult(
    geometry,
    heights,
    result.min_height,
    result.max_height,
  );

  const delegatedTaskResult = new DelegatedWorkerTasksResult(
    delegator_id,
    undefined,
    upsampleTerrainMeshResult,
  );

  workerTaskHandler.triggerWorkerTaskCompleted(bits, delegatedTaskResult);
}
