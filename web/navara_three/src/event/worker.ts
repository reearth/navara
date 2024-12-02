import {
  TransferableMartiniLike,
  TransferableRasterDEMDataLike,
  TransferableTileLike,
  UpsamplableTerrainGeometryLike,
} from "@navara/core";
import {
  ConstructTerrainMeshParameters,
  ConstructTerrainMeshResult,
  DelegatedWorkerTasksResult,
  ReconstructableEntity,
  TransferableGeometry,
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
  const cachedMartinis = martiniCache.get(martiniId);

  // workerpool doesn't support initialize worker resource, so we need to manage heavy resource in main thread.
  // MARTINI coords is very heavy task, so we wanna avoid to clone it every frame.
  // We will reuse cloned it and transfer it, then it should be back after the task is completed.
  const martini = (() => {
    // Pop cached MARTINI instance if it's exist.
    if (cachedMartinis && cachedMartinis.length > 1) {
      const cachedMartini = cachedMartinis.pop();
      return cachedMartini;
    }
    // Clone original MARTINI instance if there is no instance.
    if (cachedMartinis) {
      const v = cachedMartinis[0].clone();
      return v;
    }
    const martini = tileHandler.getMartini(params.martini_id);
    if (!martini) return;
    const martiniLike = new TransferableMartiniLike(
      martini.coords,
      martini.size,
    );
    martini.free();
    martiniCache.set(martiniId, [martiniLike.clone()]);
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
  const { result, martini: transferredMartini } = await constructTerrainMesh(
    bytes,
    new TransferableTileLike(tile),
    new TransferableRasterDEMDataLike(elevationDecoder),
    martini,
  );

  // MARTINI's coords is very heavy, so reuse multiple the instance.
  // And it should be back after the task.
  martiniCache.get(martiniId)?.push(transferredMartini);

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

  const upsamplableTerrainGeometry = new UpsamplableTerrainGeometryLike(
    parentUvs,
    parentIndices,
    parentHeights,
  );

  const result = await upsampleTerrainMesh(
    new TransferableTileLike(tile),
    new TransferableTileLike(parentTile),
    new TransferableRasterDEMDataLike(elevationDecoder),
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
