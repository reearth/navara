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
  TransferablePolygonOutlineGeometry,
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

import type { EventContext } from ".";

export async function processWorkerTaskDelegatedEvent(
  ctx: EventContext,
  event: WorkerTaskDelegatedEvent,
) {
  const id = generate_id_from_entity(event);
  if (event.task.construct_terrain_mesh) {
    return await processConstructTerrainMesh(
      ctx,
      id,
      event.bits,
      event.task.construct_terrain_mesh,
      event.task.delegator_id,
    );
  }
  if (event.task.upsample_terrain_mesh) {
    return await processUpsampleTerrainMesh(
      ctx,
      id,
      event.bits,
      event.task.upsample_terrain_mesh,
      event.task.delegator_id,
    );
  }
  if (event.task.construct_polygon_batched_feature) {
    return await processConstructPolygonBatchedFeature(
      ctx,
      id,
      event.bits,
      event.task.construct_polygon_batched_feature,
      event.task.delegator_id,
    );
  }
  if (event.task.construct_polyline_batched_feature) {
    return await processConstructPolylineBatchedFeature(
      ctx,
      id,
      event.bits,
      event.task.construct_polyline_batched_feature,
      event.task.delegator_id,
    );
  }
}

export async function processWorkerTaskRemovedEvent(
  ctx: EventContext,
  event: EntityEvent,
) {
  const id = generate_id_from_entity(event);
  const promise = ctx.workerPoolPromises.get(id);
  if (promise) {
    await promise.cancel();
    ctx.workerPoolPromises.delete(id);
  }
}

async function processConstructTerrainMesh(
  ctx: EventContext,
  id: string,
  bits: bigint,
  params: ConstructTerrainMeshParameters,
  delegator_id: ReconstructableEntity,
) {
  const {
    buf: bufHandler,
    tileHandler,
    workerTaskHandler,
    workerPoolPromises,
  } = ctx;
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
    params.skirt,
    params.skirtExaggeration,
  );
  workerPoolPromises.set(id, promise);
  const { result } = await promise;
  workerPoolPromises.delete(id);

  params.free();

  if (!workerTaskHandler.hasWorkerTask(delegator_id[0])) return;

  const vertices = bufHandler.newF32(result.vertices);
  const uvs = bufHandler.newF32(result.uvs);
  const indices = bufHandler.newU32(result.indices);
  const heights = bufHandler.newF32(result.heights);
  if (!vertices || !uvs || !indices || !heights) {
    return;
  }

  const geometry = new TransferableGeometry(vertices, uvs, indices);

  // Set skirt data if available
  if (result.skirt_vertices && result.skirt_uvs && result.skirt_indices) {
    const skirtVertices = bufHandler.newF32(result.skirt_vertices);
    const skirtUvs = bufHandler.newF32(result.skirt_uvs);
    const skirtIndices = bufHandler.newU32(result.skirt_indices);
    const skirtIndicesToEdge = result.skirt_indices_to_edge
      ? bufHandler.newU32(result.skirt_indices_to_edge)
      : undefined;

    if (skirtVertices != null) {
      geometry.skirt_vertices = skirtVertices;
    }
    if (skirtUvs != null) {
      geometry.skirt_uvs = skirtUvs;
    }
    if (skirtIndices != null) {
      geometry.skirt_indices = skirtIndices;
    }
    if (skirtIndicesToEdge != null) {
      geometry.skirt_indices_to_edge = skirtIndicesToEdge;
    }
  }

  const rtcTranslation = result.rtc_translation;
  const constructTerrainMeshResult = new ConstructTerrainMeshResult(
    geometry,
    heights,
    result.min_height,
    result.max_height,
    rtcTranslation
      ? new Vec3(rtcTranslation.x, rtcTranslation.y, rtcTranslation.z)
      : undefined,
  );

  const delegatedTaskResult =
    DelegatedWorkerTasksResult.withConstructTerrainMesh(
      delegator_id,
      constructTerrainMeshResult,
    );

  workerTaskHandler.triggerWorkerTaskCompleted(bits, delegatedTaskResult);
}

async function processUpsampleTerrainMesh(
  ctx: EventContext,
  id: string,
  bits: bigint,
  params: UpsampleTerrainMeshParameters,
  delegator_id: ReconstructableEntity,
) {
  const {
    buf: bufHandler,
    tileHandler,
    workerTaskHandler,
    workerPoolPromises,
  } = ctx;
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
    params.skirt,
    params.skirtExaggeration,
  );
  workerPoolPromises.set(id, promise);
  const result = await promise;
  workerPoolPromises.delete(id);

  params.free();

  if (!workerTaskHandler.hasWorkerTask(delegator_id[0])) return;

  const vertices = bufHandler.newF32(result.vertices);
  const uvs = bufHandler.newF32(result.uvs);
  const indices = bufHandler.newU32(result.indices);
  const heights = bufHandler.newF32(result.heights);
  if (!vertices || !uvs || !indices || !heights) {
    return;
  }

  const geometry = new TransferableGeometry(vertices, uvs, indices);

  // Set skirt data if available
  if (result.skirt_vertices && result.skirt_uvs && result.skirt_indices) {
    const skirtVertices = bufHandler.newF32(result.skirt_vertices);
    const skirtUvs = bufHandler.newF32(result.skirt_uvs);
    const skirtIndices = bufHandler.newU32(result.skirt_indices);
    const skirtIndicesToEdge = result.skirt_indices_to_edge
      ? bufHandler.newU32(result.skirt_indices_to_edge)
      : undefined;

    if (skirtVertices != null) {
      geometry.skirt_vertices = skirtVertices;
    }
    if (skirtUvs != null) {
      geometry.skirt_uvs = skirtUvs;
    }
    if (skirtIndices != null) {
      geometry.skirt_indices = skirtIndices;
    }
    if (skirtIndicesToEdge != null) {
      geometry.skirt_indices_to_edge = skirtIndicesToEdge;
    }
  }

  const rtcTranslation = result.rtc_translation;
  const upsampleTerrainMeshResult = new UpsampleTerrainMeshResult(
    geometry,
    heights,
    result.min_height,
    result.max_height,
    rtcTranslation
      ? new Vec3(rtcTranslation.x, rtcTranslation.y, rtcTranslation.z)
      : undefined,
  );

  const delegatedTaskResult =
    DelegatedWorkerTasksResult.withUpsampleTerrainMesh(
      delegator_id,
      upsampleTerrainMeshResult,
    );

  workerTaskHandler.triggerWorkerTaskCompleted(bits, delegatedTaskResult);
}

async function processConstructPolygonBatchedFeature(
  ctx: EventContext,
  id: string,
  bits: bigint,
  params: ConstructPolygonBatchedFeatureParameters,
  delegator_id: ReconstructableEntity,
) {
  const {
    buf: bufHandler,
    featureHandler,
    workerTaskHandler,
    workerPoolPromises,
  } = ctx;
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

  // transferable.free();
  params.free();

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

  // Construct outline geometry if present
  let outlineGeometry: TransferablePolygonOutlineGeometry | undefined;
  if (result.outline_position) {
    const outlinePosition = bufHandler.newF32(result.outline_position);
    const outlineScaleNormalAndCap = result.outline_scale_normal_and_cap
      ? bufHandler.newF32(result.outline_scale_normal_and_cap)
      : undefined;
    const outlineSkipIndices = result.outline_skip_indices
      ? bufHandler.newU32(result.outline_skip_indices)
      : undefined;

    const outlineBatchIndex = result.outline_batch_index
      ? bufHandler.newF32(result.outline_batch_index)
      : undefined;

    outlineGeometry = new TransferablePolygonOutlineGeometry(
      outlinePosition
        ? new TransferableFloatAttribute(
            outlinePosition,
            result.outline_position_size ?? 3,
          )
        : undefined,
      outlineScaleNormalAndCap
        ? new TransferableFloatAttribute(
            outlineScaleNormalAndCap,
            result.outline_scale_normal_and_cap_size ?? 4,
          )
        : undefined,
      outlineSkipIndices,
      outlineBatchIndex
        ? new TransferableFloatAttribute(
            outlineBatchIndex,
            result.outline_batch_index_size ?? 1,
          )
        : undefined,
    );
  }

  const extent = result.extent;
  const rtc_translation = result.rtc_translation;
  const constructPolygonBatchedFeatureResult =
    new ConstructPolygonBatchedFeatureResult(
      geometry,
      outlineGeometry,
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
  ctx: EventContext,
  id: string,
  bits: bigint,
  params: ConstructPolylineBatchedFeatureParameters,
  delegator_id: ReconstructableEntity,
) {
  const {
    buf: bufHandler,
    featureHandler,
    workerTaskHandler,
    workerPoolPromises,
  } = ctx;
  const transferable = featureHandler.getTransferablePolylineBatchedFeature(
    params.batched_feature[0],
  );

  if (!transferable) return;

  const promise = constructPolylineBatchedFeature(
    new TransferablePolylineBatchedFeatureLike(transferable),
    new PolylineMaterialLike(transferable.material),
    params.flat,
  );
  workerPoolPromises.set(id, promise);
  const result = await promise;
  workerPoolPromises.delete(id);

  transferable.free();
  params.free();

  if (!result || !result.batch_id || !result.batch_index) return;

  if (!workerTaskHandler.hasWorkerTask(delegator_id[0])) return;

  const position = bufHandler.newF32(result.position);
  const positionHigh = result.position_high
    ? bufHandler.newF32(result.position_high)
    : undefined;
  const positionLow = result.position_low
    ? bufHandler.newF32(result.position_low)
    : undefined;
  const start = bufHandler.newF32(result.start);
  const startHigh = result.start_high
    ? bufHandler.newF32(result.start_high)
    : undefined;
  const startLow = result.start_low
    ? bufHandler.newF32(result.start_low)
    : undefined;
  const startNormals = bufHandler.newF32(result.start_normals);
  const forwardOffset = bufHandler.newF32(result.forward_offset);
  const endHigh = result.end_high
    ? bufHandler.newF32(result.end_high)
    : undefined;
  const endLow = result.end_low ? bufHandler.newF32(result.end_low) : undefined;
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
  const transferablePositionHigh = positionHigh
    ? new TransferableFloatAttribute(
        positionHigh,
        result.position_high_size ?? 0,
      )
    : undefined;
  const transferablePositionLow = positionLow
    ? new TransferableFloatAttribute(positionLow, result.position_low_size ?? 0)
    : undefined;
  const transferableStart = new TransferableFloatAttribute(
    start,
    result.start_size,
  );
  const transferableStartHigh = startHigh
    ? new TransferableFloatAttribute(startHigh, result.start_high_size ?? 0)
    : undefined;
  const transferableStartLow = startLow
    ? new TransferableFloatAttribute(startLow, result.start_low_size ?? 0)
    : undefined;
  const transferableEndHigh = endHigh
    ? new TransferableFloatAttribute(endHigh, result.end_high_size ?? 0)
    : undefined;
  const transferableEndLow = endLow
    ? new TransferableFloatAttribute(endLow, result.end_low_size ?? 0)
    : undefined;
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
    transferablePositionHigh,
    transferablePositionLow,
    transferableStart,
    transferableStartHigh,
    transferableStartLow,
    transferableForwardOffset,
    transferableEndHigh,
    transferableEndLow,
    transferableStartNormals,
    transferableEndNormalAndTextureCoordinateNormalizationX,
    transferableRightNormalAndTextureCoordinateNormalizationY,
    transferableBatchId,
    transferableBatchIndex,
    indices,
  );

  const extent = result.extent;
  const constructPolylineBatchedFeatureResult =
    new ConstructPolylineBatchedFeatureResult(
      geometry,
      extent
        ? new ExtentRadianF32(
            extent.west,
            extent.south,
            extent.east,
            extent.north,
          )
        : undefined,
    );

  const delegatedTaskResult =
    DelegatedWorkerTasksResult.withConstructPolylineBatchedFeature(
      delegator_id,
      constructPolylineBatchedFeatureResult,
    );

  workerTaskHandler.triggerWorkerTaskCompleted(bits, delegatedTaskResult);
}
