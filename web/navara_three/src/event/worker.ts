import {
  PolygonMaterialLike,
  TransferableMartiniLike,
  TransferablePolygonBatchedFeatureLike,
  TransferableRasterDEMDataLike,
  TransferableTileLike,
  UpsamplableTerrainGeometryLike,
} from "@navara/core";
import {
  ConstructPolygonBatchedFeatureParameters,
  ConstructPolygonBatchedFeatureResult,
  ConstructTerrainMeshParameters,
  ConstructTerrainMeshResult,
  DelegatedWorkerTasksResult,
  ExtentRadianF32,
  ReconstructableEntity,
  TransferableFloatAttribute,
  TransferableGeometry,
  TransferablePolygonGeometry,
  UpsampleTerrainMeshParameters,
  UpsampleTerrainMeshResult,
  type WorkerTaskDelegatedEvent,
} from "@navara/engine";

import { constructPolygonBatchedFeature } from "../tasks/constructPolygonBatchedFeature";
import { constructTerrainMesh } from "../tasks/constructTerrainMesh";
import { upsampleTerrainMesh } from "../tasks/upsampleTerrainMesh";
import type { MartiniCache } from "../type";

import type {
  BufferLoader,
  FeatureHandler,
  TileHandler,
  WorkerTaskHandler,
} from ".";

export async function processWorkerTaskDelegatedEvent(
  event: WorkerTaskDelegatedEvent,
  bufHandler: BufferLoader,
  tileHandler: TileHandler,
  featureHandler: FeatureHandler,
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
  if (event.task.construct_polygon_batched_feature) {
    return await processConstructPolygonBatchedFeature(
      event.bits,
      event.task.construct_polygon_batched_feature,
      event.task.delegator_id,
      bufHandler,
      featureHandler,
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

  const delegatedTaskResult =
    DelegatedWorkerTasksResult.withConstructTerrainMesh(
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

  const delegatedTaskResult =
    DelegatedWorkerTasksResult.withUpsampleTerrainMesh(
      delegator_id,
      upsampleTerrainMeshResult,
    );

  workerTaskHandler.triggerWorkerTaskCompleted(bits, delegatedTaskResult);
}

async function processConstructPolygonBatchedFeature(
  bits: bigint,
  params: ConstructPolygonBatchedFeatureParameters,
  delegator_id: ReconstructableEntity,
  bufHandler: BufferLoader,
  featureHandler: FeatureHandler,
  workerTaskHandler: WorkerTaskHandler,
) {
  const transferable = featureHandler.getTransferablePolygonBatchedFeature(
    params.batched_feature[0],
  );

  if (!transferable) return;

  const result = await constructPolygonBatchedFeature(
    new TransferablePolygonBatchedFeatureLike(transferable.transferable()),
    new PolygonMaterialLike(transferable.material),
  );

  if (
    !result ||
    !result.geometry.attributes.batch_id ||
    !result.geometry.attributes.normal ||
    !result.geometry.attributes.scale_normal_and_cap
  )
    return;

  const batchId = bufHandler.newF32(result.geometry.attributes.batch_id.data);
  const normal = bufHandler.newF32(result.geometry.attributes.normal.data);
  const position = bufHandler.newF32(result.geometry.attributes.position.data);
  const scaleNormalAndCap = bufHandler.newF32(
    result.geometry.attributes.scale_normal_and_cap.data,
  );
  const indices = bufHandler.newU32(result.geometry.indices);
  if (!batchId || !normal || !position || !scaleNormalAndCap || !indices) {
    return;
  }

  const transferableBatchId = new TransferableFloatAttribute(
    batchId,
    result.geometry.attributes.batch_id.size,
  );
  const transferableNormal = new TransferableFloatAttribute(
    normal,
    result.geometry.attributes.normal.size,
  );
  const transferablePosition = new TransferableFloatAttribute(
    position,
    result.geometry.attributes.position.size,
  );
  const transferableScaleNormalAndCap = new TransferableFloatAttribute(
    scaleNormalAndCap,
    result.geometry.attributes.scale_normal_and_cap.size,
  );
  const geometry = new TransferablePolygonGeometry(
    transferablePosition,
    transferableNormal,
    transferableScaleNormalAndCap,
    transferableBatchId,
    indices,
  );

  const constructPolygonBatchedFeatureResult =
    new ConstructPolygonBatchedFeatureResult(
      geometry,
      new ExtentRadianF32(
        result.extent.west,
        result.extent.south,
        result.extent.east,
        result.extent.north,
      ),
    );

  const delegatedTaskResult =
    DelegatedWorkerTasksResult.withConstructPolygonBatchedFeature(
      delegator_id,
      constructPolygonBatchedFeatureResult,
    );

  workerTaskHandler.triggerWorkerTaskCompleted(bits, delegatedTaskResult);
}
