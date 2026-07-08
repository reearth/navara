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
  ParseMvtTileParameters,
  ParseMvtTileResult,
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
import { constructQuantizedMeshTerrainMesh } from "../tasks/constructQuantizedMeshTerrainMesh";
import { constructTerrainMesh } from "../tasks/constructTerrainMesh";
import { parseMvtTile } from "../tasks/parseMvtTile";
import { upsampleQuantizedMeshTerrainMesh } from "../tasks/upsampleQuantizedMeshTerrainMesh";
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
  if (event.task.parse_mvt_tile) {
    return await processParseMvtTile(
      ctx,
      id,
      event.bits,
      event.task.parse_mvt_tile,
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
  // buf.u8 returns a short-lived view into WASM memory; copy it since the
  // bytes are transferred to the worker (a view's buffer is the whole WASM
  // memory and is not detachable).
  const bytes = bufHandler.u8(params.bytes_handle)?.slice();
  if (!bytes) {
    return;
  }

  const tile = tileHandler.getTile(params.tile_handle);
  if (!tile) {
    return;
  }

  let promise: ReturnType<
    typeof constructQuantizedMeshTerrainMesh | typeof constructTerrainMesh
  >;
  if (params.isQuantizedMesh) {
    promise = constructQuantizedMeshTerrainMesh(
      bytes,
      new TransferableTileLike(tile),
      params.skirt,
      params.skirtExaggeration,
      params.geographic,
      params.tms,
    );
  } else {
    const elevationDecoder = tileHandler.getTileElevationDecoder(
      params.tile_handle,
    );
    if (!elevationDecoder) {
      return;
    }
    promise = constructTerrainMesh(
      bytes,
      new TransferableTileLike(tile),
      new TransferableRasterDEMDataLike(elevationDecoder),
      params.tile_size,
      params.skirt,
      params.skirtExaggeration,
    );
  }
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

  if (result.normals) {
    const normals = bufHandler.newF32(result.normals);
    if (normals != null) geometry.normals = normals;
  }

  // Set skirt data if available
  if (result.skirt_vertices && result.skirt_uvs && result.skirt_indices) {
    const skirtVertices = bufHandler.newF32(result.skirt_vertices);
    const skirtUvs = bufHandler.newF32(result.skirt_uvs);
    const skirtIndices = bufHandler.newU32(result.skirt_indices);
    const skirtNormals = result.skirt_normals
      ? bufHandler.newF32(result.skirt_normals)
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
    if (skirtNormals != null) {
      geometry.skirt_normals = skirtNormals;
    }
  }

  const rtcTranslation = result.rtc_translation;
  const watermaskHandle = result.watermask
    ? bufHandler.newU8(result.watermask)
    : undefined;

  const constructTerrainMeshResult = new ConstructTerrainMeshResult(
    geometry,
    heights,
    result.min_height,
    result.max_height,
    rtcTranslation
      ? new Vec3(rtcTranslation.x, rtcTranslation.y, rtcTranslation.z)
      : undefined,
  );
  if (watermaskHandle != null) {
    constructTerrainMeshResult.watermask = watermaskHandle;
  }

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

  // buf.* return short-lived views into WASM memory; copy them since the
  // parent geometry is sent to the worker (a view's buffer is the whole WASM
  // memory and is not transferable).
  const parentUvs = bufHandler.f32(cachedMeshHandle.uvs)?.slice();
  const parentIndices = bufHandler.u32(cachedMeshHandle.indices)?.slice();
  const parentHeights = bufHandler.f32(cachedMeshHandle.heights)?.slice();
  if (!parentUvs || !parentIndices || !parentHeights) {
    return;
  }

  const parentNormalsHandle = cachedMeshHandle.normals;
  const parentNormals =
    parentNormalsHandle != null
      ? bufHandler.f32(parentNormalsHandle)?.slice()
      : undefined;

  const upsamplableTerrainGeometry = new UpsamplableTerrainGeometryLike(
    parentUvs,
    parentIndices,
    parentHeights,
    parentNormals,
  );

  let promise: ReturnType<
    typeof upsampleQuantizedMeshTerrainMesh | typeof upsampleTerrainMesh
  >;
  if (params.isQuantizedMesh) {
    promise = upsampleQuantizedMeshTerrainMesh(
      new TransferableTileLike(tile),
      new TransferableTileLike(parentTile),
      upsamplableTerrainGeometry,
      params.skirt,
      params.skirtExaggeration,
      params.geographic,
      params.tms,
    );
  } else {
    const elevationDecoder = tileHandler.getTileElevationDecoder(
      params.tile_handle,
    );
    if (!elevationDecoder) {
      return;
    }
    promise = upsampleTerrainMesh(
      new TransferableTileLike(tile),
      new TransferableTileLike(parentTile),
      new TransferableRasterDEMDataLike(elevationDecoder),
      upsamplableTerrainGeometry,
      params.skirt,
      params.skirtExaggeration,
      params.tms,
    );
  }
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

  if (result.normals) {
    const normals = bufHandler.newF32(result.normals);
    if (normals != null) geometry.normals = normals;
  }

  // Set skirt data if available
  if (result.skirt_vertices && result.skirt_uvs && result.skirt_indices) {
    const skirtVertices = bufHandler.newF32(result.skirt_vertices);
    const skirtUvs = bufHandler.newF32(result.skirt_uvs);
    const skirtIndices = bufHandler.newU32(result.skirt_indices);
    const skirtNormals = result.skirt_normals
      ? bufHandler.newF32(result.skirt_normals)
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
    if (skirtNormals != null) {
      geometry.skirt_normals = skirtNormals;
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
  const start = result.start ? bufHandler.newF32(result.start) : undefined;
  const startHigh = result.start_high
    ? bufHandler.newF32(result.start_high)
    : undefined;
  const startLow = result.start_low
    ? bufHandler.newF32(result.start_low)
    : undefined;
  const startNormals = result.start_normals
    ? bufHandler.newF32(result.start_normals)
    : undefined;
  const forwardOffset = result.forward_offset
    ? bufHandler.newF32(result.forward_offset)
    : undefined;
  const endHigh = result.end_high
    ? bufHandler.newF32(result.end_high)
    : undefined;
  const endLow = result.end_low ? bufHandler.newF32(result.end_low) : undefined;
  const endNormalAndTextureCoordinateNormalizationX =
    result.end_normal_and_texture_coordinate_normalization_x
      ? bufHandler.newF32(
          result.end_normal_and_texture_coordinate_normalization_x,
        )
      : undefined;
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
  const transferableStart = start
    ? new TransferableFloatAttribute(start, result.start_size ?? 0)
    : undefined;
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
  const transferableStartNormals = startNormals
    ? new TransferableFloatAttribute(
        startNormals,
        result.start_normals_size ?? 0,
      )
    : undefined;
  const transferableForwardOffset = forwardOffset
    ? new TransferableFloatAttribute(
        forwardOffset,
        result.forward_offset_size ?? 0,
      )
    : undefined;
  const transferableEndNormalAndTextureCoordinateNormalizationX =
    endNormalAndTextureCoordinateNormalizationX
      ? new TransferableFloatAttribute(
          endNormalAndTextureCoordinateNormalizationX,
          result.end_normal_and_texture_coordinate_normalization_x_size ?? 0,
        )
      : undefined;
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

async function processParseMvtTile(
  ctx: EventContext,
  id: string,
  bits: bigint,
  params: ParseMvtTileParameters,
  delegator_id: ReconstructableEntity,
) {
  const { buf: bufHandler, workerTaskHandler, workerPoolPromises } = ctx;

  // A parse that fails after dispatch must still complete the task: a
  // delegator that never completes stays Requested forever and permanently
  // occupies one of the engine's pending parse slots. Completing with an
  // empty result finalizes the tile with zero features, matching the
  // synchronous path's behavior for an unparseable tile.
  const completeWithEmptyResult = () => {
    workerTaskHandler.triggerWorkerTaskCompleted(
      bits,
      DelegatedWorkerTasksResult.withParseMvtTile(
        delegator_id,
        ParseMvtTileResult.empty(),
      ),
    );
  };

  // Move the pbf out of the BufferStore as we hand a copy to the worker: the
  // main thread never reuses it (geometry comes back from the worker), so this
  // avoids keeping the tile's bytes resident on the main thread for the whole
  // parse. (finalize/cancel still call `buf.remove` as a no-op safety net for
  // tasks that were cancelled before ever being dispatched here.)
  const bytes = bufHandler.removeU8(params.pbf_handle);
  if (!bytes) {
    params.free();
    completeWithEmptyResult();
    return;
  }

  const promise = parseMvtTile(
    bytes,
    params.x,
    params.y,
    params.z,
    params.tile_extent
      ? new ExtentRadianF32Like(params.tile_extent)
      : undefined,
    params.compression,
    params.configs_json,
  );
  workerPoolPromises.set(id, promise);
  let result: Awaited<typeof promise>;
  try {
    result = await promise;
  } catch (err) {
    // The pool rejects the promise when the task is cancelled (tile evicted
    // while parsing); there is nothing to deliver then — the engine already
    // marked the task Deleted. Any other worker failure still completes the
    // task, with zero features.
    if (err instanceof Error && err.name === "CancellationError") return;
    console.error("Failed to parse MVT tile in worker:", err);
    completeWithEmptyResult();
    return;
  } finally {
    // Run on every path (resolve, cancel, worker error) so the boundary
    // params object is never leaked.
    workerPoolPromises.delete(id);
    params.free();
  }

  // Nothing is registered in the BufferStore before this check, so a vanished
  // task leaks nothing.
  if (!workerTaskHandler.hasWorkerTask(delegator_id[0])) return;

  // Store the four packed streams in the BufferStore (writing straight into
  // WASM memory) and hand the engine only their handles; the delegated-task
  // system frees them on every path, including a deleted delegator.
  const f64Handle = bufHandler.newF64(result.f64_stream);
  const f32Handle = bufHandler.newF32(result.f32_stream);
  const u32Handle = bufHandler.newU32(result.u32_stream);
  const u8Handle = bufHandler.newU8(result.u8_stream);
  if (
    f64Handle == null ||
    f32Handle == null ||
    u32Handle == null ||
    u8Handle == null
  ) {
    // Handles are never reused, so any stream registered before the failure
    // must be freed here or it stays in the BufferStore forever.
    for (const handle of [f64Handle, f32Handle, u32Handle, u8Handle]) {
      if (handle != null) {
        bufHandler.remove(handle);
      }
    }
    completeWithEmptyResult();
    return;
  }

  // The wasm-bindgen constructor deserializes `meta` and can throw (it returns
  // Result on the Rust side). The four handles registered above are owned by
  // nobody until the result reaches the engine, so free them on failure or
  // they stay in the BufferStore forever.
  let parseResult: ParseMvtTileResult;
  try {
    parseResult = new ParseMvtTileResult(
      f64Handle,
      f32Handle,
      u32Handle,
      u8Handle,
      result.meta,
    );
  } catch (err) {
    for (const handle of [f64Handle, f32Handle, u32Handle, u8Handle]) {
      bufHandler.remove(handle);
    }
    console.error("Failed to deserialize MVT tile meta:", err);
    completeWithEmptyResult();
    return;
  }

  const delegatedTaskResult = DelegatedWorkerTasksResult.withParseMvtTile(
    delegator_id,
    parseResult,
  );

  workerTaskHandler.triggerWorkerTaskCompleted(bits, delegatedTaskResult);
}
