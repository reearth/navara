import {
  generate_id_from_entity,
  PolygonMaterialLike,
  TransferablePolygonBatchedFeatureLike,
  TransferableRasterDEMDataLike,
  TransferableTileLike,
  UpsamplableTerrainGeometryLike,
  PolylineMaterialLike,
  TransferablePolylineBatchedFeatureLike,
  ExtentRadianF32Like,
} from "@navara/core";
import {
  ConstructPolygonBatchedFeatureParameters,
  ConstructPolygonBatchedFeatureResult,
  ConstructPolylineBatchedFeatureParameters,
  ConstructPolylineBatchedFeatureResult,
  ConstructTerrainMeshParameters,
  ConstructTerrainMeshResult,
  DelegatedWorkerTasksResult,
  EntityEvent,
  ExtentRadianF32,
  ReconstructableEntity,
  TransferableFloatAttribute,
  TransferableGeometry,
  TransferablePolygonGeometry,
  TransferablePolylineGeometry,
  TransferableUintAttribute,
  UpsampleTerrainMeshParameters,
  UpsampleTerrainMeshResult,
  Vec3,
  type WorkerTaskDelegatedEvent,
} from "@navara/engine";

import { constructPolygonBatchedFeature } from "../tasks/constructPolygonBatchedFeature";
import { constructPolylineBatchedFeature } from "../tasks/constructPolylineBatchedFeature";
import { constructTerrainMesh } from "../tasks/constructTerrainMesh";
import { upsampleTerrainMesh } from "../tasks/upsampleTerrainMesh";
import type { WorkerPoolPromises } from "../type";

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
  workerPoolPromises: WorkerPoolPromises,
) {
  const id = generate_id_from_entity(event);
  if (event.task.construct_terrain_mesh) {
    return await processConstructTerrainMesh(
      id,
      event.bits,
      event.task.construct_terrain_mesh,
      event.task.delegator_id,
      bufHandler,
      tileHandler,
      workerTaskHandler,
      workerPoolPromises,
    );
  }
  if (event.task.upsample_terrain_mesh) {
    return await processUpsampleTerrainMesh(
      id,
      event.bits,
      event.task.upsample_terrain_mesh,
      event.task.delegator_id,
      bufHandler,
      tileHandler,
      workerTaskHandler,
      workerPoolPromises,
    );
  }
  if (event.task.construct_polygon_batched_feature) {
    return await processConstructPolygonBatchedFeature(
      id,
      event.bits,
      event.task.construct_polygon_batched_feature,
      event.task.delegator_id,
      bufHandler,
      featureHandler,
      workerTaskHandler,
      workerPoolPromises,
    );
  }
  if (event.task.construct_polyline_batched_feature) {
    return await processConstructPolylineBatchedFeature(
      id,
      event.bits,
      event.task.construct_polyline_batched_feature,
      event.task.delegator_id,
      bufHandler,
      featureHandler,
      workerTaskHandler,
      workerPoolPromises,
    );
  }
}

export async function processWorkerTaskRemovedEvent(
  event: EntityEvent,
  workerPoolPromises: WorkerPoolPromises,
) {
  const id = generate_id_from_entity(event);
  const promise = workerPoolPromises.get(id);
  if (promise) {
    await promise.cancel();
    workerPoolPromises.delete(id);
  }
}

async function processConstructTerrainMesh(
  id: string,
  bits: bigint,
  params: ConstructTerrainMeshParameters,
  delegator_id: ReconstructableEntity,
  bufHandler: BufferLoader,
  tileHandler: TileHandler,
  workerTaskHandler: WorkerTaskHandler,
  workerPoolPromises: WorkerPoolPromises,
) {
  const bytes = bufHandler.u8(params.bytes_handle);
  if (!bytes) {
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
  const promise = constructTerrainMesh(
    bytes,
    new TransferableTileLike(tile),
    new TransferableRasterDEMDataLike(elevationDecoder),
    params.tile_size,
  );
  workerPoolPromises.set(id, promise);
  const { result } = await promise;
  workerPoolPromises.delete(id);

  if (!workerTaskHandler.hasWorkerTask(delegator_id[0])) return;

  const vertices = bufHandler.newF32(result.vertices);
  const uvs = bufHandler.newF32(result.uvs);
  const indices = bufHandler.newU32(result.indices);
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
  id: string,
  bits: bigint,
  params: UpsampleTerrainMeshParameters,
  delegator_id: ReconstructableEntity,
  bufHandler: BufferLoader,
  tileHandler: TileHandler,
  workerTaskHandler: WorkerTaskHandler,
  workerPoolPromises: WorkerPoolPromises,
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

  const promise = upsampleTerrainMesh(
    new TransferableTileLike(tile),
    new TransferableTileLike(parentTile),
    new TransferableRasterDEMDataLike(elevationDecoder),
    upsamplableTerrainGeometry,
  );
  workerPoolPromises.set(id, promise);
  const result = await promise;
  workerPoolPromises.delete(id);

  if (!workerTaskHandler.hasWorkerTask(delegator_id[0])) return;

  const vertices = bufHandler.newF32(result.vertices);
  const uvs = bufHandler.newF32(result.uvs);
  const indices = bufHandler.newU32(result.indices);
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
  id: string,
  bits: bigint,
  params: ConstructPolygonBatchedFeatureParameters,
  delegator_id: ReconstructableEntity,
  bufHandler: BufferLoader,
  featureHandler: FeatureHandler,
  workerTaskHandler: WorkerTaskHandler,
  workerPoolPromises: WorkerPoolPromises,
) {
  const transferable = featureHandler.getTransferablePolygonBatchedFeature(
    params.batched_feature[0],
  );

  if (!transferable) return;

  const promise = constructPolygonBatchedFeature(
    new TransferablePolygonBatchedFeatureLike(transferable),
    new PolygonMaterialLike(transferable.material),
    params.flat,
    params.tile_extent
      ? new ExtentRadianF32Like(params.tile_extent)
      : undefined,
  );
  workerPoolPromises.set(id, promise);
  const result = await promise;
  workerPoolPromises.delete(id);

  if (!result) return;

  if (!workerTaskHandler.hasWorkerTask(delegator_id[0])) return;

  const batchId = result.batch_id
    ? bufHandler.newF32(result.batch_id)
    : undefined;
  const batchIndex = result.batch_index
    ? bufHandler.newU32(result.batch_index)
    : undefined;
  const normal = result.normal ? bufHandler.newF32(result.normal) : undefined;
  const position = result.position
    ? bufHandler.newF32(result.position)
    : undefined;
  const position3dHigh = result.position_3d_high
    ? bufHandler.newF32(result.position_3d_high)
    : undefined;
  const position3dLow = result.position_3d_low
    ? bufHandler.newF32(result.position_3d_low)
    : undefined;
  const scaleNormalAndCap = result.scale_normal_and_cap
    ? bufHandler.newF32(result.scale_normal_and_cap)
    : undefined;
  const indices = bufHandler.newU32(result.indices);
  if (!indices) {
    return;
  }
  // Either position or (position_3d_high and position_3d_low) must be present
  if (!position && (!position3dHigh || !position3dLow)) {
    return;
  }

  const transferableBatchId = batchId
    ? new TransferableFloatAttribute(batchId, result.batch_id_size ?? 0)
    : undefined;
  const transferableBatchIndex = batchIndex
    ? new TransferableUintAttribute(batchIndex, result.batch_index_size ?? 0)
    : undefined;
  const transferableNormal = normal
    ? new TransferableFloatAttribute(normal, result.normal_size ?? 0)
    : undefined;
  const transferablePosition = position
    ? new TransferableFloatAttribute(position, result.position_size ?? 0)
    : undefined;
  const transferablePosition3dHigh = position3dHigh
    ? new TransferableFloatAttribute(
        position3dHigh,
        result.position_3d_high_size ?? 0,
      )
    : undefined;
  const transferablePosition3dLow = position3dLow
    ? new TransferableFloatAttribute(
        position3dLow,
        result.position_3d_low_size ?? 0,
      )
    : undefined;
  const transferableScaleNormalAndCap = scaleNormalAndCap
    ? new TransferableFloatAttribute(
        scaleNormalAndCap,
        result.scale_normal_and_cap_size ?? 0,
      )
    : undefined;
  const geometry = new TransferablePolygonGeometry(
    transferablePosition,
    transferablePosition3dHigh,
    transferablePosition3dLow,
    transferableNormal,
    transferableScaleNormalAndCap,
    transferableBatchId,
    transferableBatchIndex,
    indices,
  );

  const extent = result.extent;
  const rtc_translation = result.rtc_translation;
  const constructPolygonBatchedFeatureResult =
    new ConstructPolygonBatchedFeatureResult(
      geometry,
      extent
        ? new ExtentRadianF32(
            extent.west,
            extent.south,
            extent.east,
            extent.north,
          )
        : undefined,

      rtc_translation
        ? new Vec3(rtc_translation.x, rtc_translation.y, rtc_translation.z)
        : undefined, // RTC translation from worker
    );

  const delegatedTaskResult =
    DelegatedWorkerTasksResult.withConstructPolygonBatchedFeature(
      delegator_id,
      constructPolygonBatchedFeatureResult,
    );

  workerTaskHandler.triggerWorkerTaskCompleted(bits, delegatedTaskResult);
}

async function processConstructPolylineBatchedFeature(
  id: string,
  bits: bigint,
  params: ConstructPolylineBatchedFeatureParameters,
  delegator_id: ReconstructableEntity,
  bufHandler: BufferLoader,
  featureHandler: FeatureHandler,
  workerTaskHandler: WorkerTaskHandler,
  workerPoolPromises: WorkerPoolPromises,
) {
  const transferable = featureHandler.getTransferablePolylineBatchedFeature(
    params.batched_feature[0],
  );

  if (!transferable) return;

  const promise = constructPolylineBatchedFeature(
    new TransferablePolylineBatchedFeatureLike(transferable),
    new PolylineMaterialLike(transferable.material),
  );
  workerPoolPromises.set(id, promise);
  const result = await promise;
  workerPoolPromises.delete(id);

  transferable.free();

  if (!result || !result.batch_id || !result.batch_index) return;

  if (!workerTaskHandler.hasWorkerTask(delegator_id[0])) return;

  const position = bufHandler.newF32(result.position);
  const start = bufHandler.newF32(result.start);
  const startNormals = bufHandler.newF32(result.start_normals);
  const forwardOffset = bufHandler.newF32(result.forward_offset);
  const endNormalAndTextureCoordinateNormalizationX = bufHandler.newF32(
    result.end_normal_and_texture_coordinate_normalization_x,
  );
  const rightNormalAndTextureCoordinateNormalizationY = bufHandler.newF32(
    result.right_normal_and_texture_coordinate_normalization_y,
  );
  const batchId = bufHandler.newF32(result.batch_id);
  const batchIndex = bufHandler.newU32(result.batch_index);
  const indices = bufHandler.newU32(result.indices);
  if (
    !batchId ||
    !batchIndex ||
    !position ||
    !start ||
    !startNormals ||
    !forwardOffset ||
    !endNormalAndTextureCoordinateNormalizationX ||
    !rightNormalAndTextureCoordinateNormalizationY ||
    !indices
  ) {
    return;
  }

  const transferableBatchId = new TransferableFloatAttribute(
    batchId,
    result.batch_id_size ?? 0,
  );
  const transferableBatchIndex = new TransferableUintAttribute(
    batchIndex,
    result.batch_index_size ?? 0,
  );
  const transferablePosition = new TransferableFloatAttribute(
    position,
    result.position_size,
  );
  const transferableStart = new TransferableFloatAttribute(
    start,
    result.start_size,
  );
  const transferableStartNormals = new TransferableFloatAttribute(
    startNormals,
    result.start_normals_size,
  );
  const transferableForwardOffset = new TransferableFloatAttribute(
    forwardOffset,
    result.forward_offset_size,
  );
  const transferableEndNormalAndTextureCoordinateNormalizationX =
    new TransferableFloatAttribute(
      endNormalAndTextureCoordinateNormalizationX,
      result.end_normal_and_texture_coordinate_normalization_x_size,
    );
  const transferableRightNormalAndTextureCoordinateNormalizationY =
    new TransferableFloatAttribute(
      rightNormalAndTextureCoordinateNormalizationY,
      result.right_normal_and_texture_coordinate_normalization_y_size,
    );

  const geometry = new TransferablePolylineGeometry(
    transferablePosition,
    transferableStart,
    transferableForwardOffset,
    transferableStartNormals,
    transferableEndNormalAndTextureCoordinateNormalizationX,
    transferableRightNormalAndTextureCoordinateNormalizationY,
    transferableBatchId,
    transferableBatchIndex,
    indices,
  );

  const constructPolylineBatchedFeatureResult =
    new ConstructPolylineBatchedFeatureResult(
      geometry,
      new ExtentRadianF32(
        result.extent.west,
        result.extent.south,
        result.extent.east,
        result.extent.north,
      ),
    );

  const delegatedTaskResult =
    DelegatedWorkerTasksResult.withConstructPolylineBatchedFeature(
      delegator_id,
      constructPolylineBatchedFeatureResult,
    );

  workerTaskHandler.triggerWorkerTaskCompleted(bits, delegatedTaskResult);
}
