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
  ConstructPolylineBatchedFeatureParameters,
  ConstructPolylineBatchedFeatureResult,
  ConstructTerrainMeshParameters,
  ConstructTerrainMeshResult,
  DelegatedWorkerTasksResult,
  ExtentRadianF32,
  ReconstructableEntity,
  TransferableFloatAttribute,
  TransferableGeometry,
  TransferablePolygonGeometry,
  TransferablePolylineGeometry,
  UpsampleTerrainMeshParameters,
  UpsampleTerrainMeshResult,
  type WorkerTaskDelegatedEvent,
} from "@navara/engine";

import {
  PolylineMaterialLike,
  TransferablePolylineBatchedFeatureLike,
} from "../packages/core/utils/polyline";
import { constructPolygonBatchedFeature } from "../tasks/constructPolygonBatchedFeature";
import { constructPolylineBatchedFeature } from "../tasks/constructPolylineBatchedFeature";
import { constructTerrainMesh } from "../tasks/constructTerrainMesh";
import { upsampleTerrainMesh } from "../tasks/upsampleTerrainMesh";

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
) {
  if (event.task.construct_terrain_mesh) {
    return await processConstructTerrainMesh(
      event.bits,
      event.task.construct_terrain_mesh,
      event.task.delegator_id,
      bufHandler,
      tileHandler,
      workerTaskHandler,
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
  if (event.task.construct_polyline_batched_feature) {
    return await processConstructPolylineBatchedFeature(
      event.bits,
      event.task.construct_polyline_batched_feature,
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
) {
  const bytes = bufHandler.u8(params.bytes_handle);
  if (!bytes) {
    return;
  }

  const martini = (() => {
    const martini = tileHandler.getMartini(params.martini_id);
    if (!martini) return;
    const martiniLike = new TransferableMartiniLike(
      martini.transfer_coords(),
      martini.size,
    );
    martini.free();
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
  const { result } = await constructTerrainMesh(
    bytes,
    new TransferableTileLike(tile),
    new TransferableRasterDEMDataLike(elevationDecoder),
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
    !result.batch_id ||
    !result.normal ||
    !result.scale_normal_and_cap
  )
    return;

  const batchId = bufHandler.newF32(result.batch_id);
  const normal = bufHandler.newF32(result.normal);
  const position = bufHandler.newF32(result.position);
  const scaleNormalAndCap = bufHandler.newF32(result.scale_normal_and_cap);
  const indices = bufHandler.newU32(result.indices);
  if (!batchId || !normal || !position || !scaleNormalAndCap || !indices) {
    return;
  }

  const transferableBatchId = new TransferableFloatAttribute(
    batchId,
    result.batch_id_size ?? 0,
  );
  const transferableNormal = new TransferableFloatAttribute(
    normal,
    result.normal_size ?? 0,
  );
  const transferablePosition = new TransferableFloatAttribute(
    position,
    result.position_size,
  );
  const transferableScaleNormalAndCap = new TransferableFloatAttribute(
    scaleNormalAndCap,
    result.scale_normal_and_cap_size ?? 0,
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

async function processConstructPolylineBatchedFeature(
  bits: bigint,
  params: ConstructPolylineBatchedFeatureParameters,
  delegator_id: ReconstructableEntity,
  bufHandler: BufferLoader,
  featureHandler: FeatureHandler,
  workerTaskHandler: WorkerTaskHandler,
) {
  const transferable = featureHandler.getTransferablePolylineBatchedFeature(
    params.batched_feature[0],
  );

  if (!transferable) return;

  const result = await constructPolylineBatchedFeature(
    new TransferablePolylineBatchedFeatureLike(transferable.transferable()),
    new PolylineMaterialLike(transferable.material),
  );

  transferable.free();

  if (!result || !result.batch_id) return;

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
  const indices = bufHandler.newU32(result.indices);
  if (
    !batchId ||
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
