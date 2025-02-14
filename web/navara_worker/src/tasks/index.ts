import { constructPolygonBatchedFeature } from "./constructPolygonBatchedFeature";
import { constructPolylineBatchedFeature } from "./constructPolylineBatchedFeature";
import { constructTerrainMesh } from "./constructTerrainMesh";
import { getImageDataFromImageBitmap } from "./getImageDataFromImageBitmap";
import { upsampleTerrainMesh } from "./upsampleTerrainMesh";

export const commonTasks = {
  constructTerrainMesh,
  upsampleTerrainMesh,
  getImageDataFromImageBitmap,
  constructPolygonBatchedFeature,
  constructPolylineBatchedFeature,
};

export type CommonTasks = typeof commonTasks;
