import { constructPolygonBatchedFeature } from "./constructPolygonBatchedFeature";
import { constructTerrainMesh } from "./constructTerrainMesh";
import { getImageDataFromImageBitmap } from "./getImageDataFromImageBitmap";
import { upsampleTerrainMesh } from "./upsampleTerrainMesh";

export const commonTasks = {
  constructTerrainMesh,
  upsampleTerrainMesh,
  getImageDataFromImageBitmap,
  constructPolygonBatchedFeature,
};
