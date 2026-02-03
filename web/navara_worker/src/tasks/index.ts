import { constructPolygonBatchedFeature } from "./constructPolygonBatchedFeature";
import { constructPolylineBatchedFeature } from "./constructPolylineBatchedFeature";
import { constructTerrainMesh } from "./constructTerrainMesh";
import { getImageDataFromImageBitmap } from "./getImageDataFromImageBitmap";
import { upsampleTerrainMesh } from "./upsampleTerrainMesh";
import { waitWasm } from "./waitWasm";

/** Pre-warm worker by initializing WASM module */
export async function warmUp(): Promise<void> {
  await waitWasm();
}

export const commonTasks = {
  constructTerrainMesh,
  upsampleTerrainMesh,
  getImageDataFromImageBitmap,
  constructPolygonBatchedFeature,
  constructPolylineBatchedFeature,
  warmUp,
};

export type CommonTasks = typeof commonTasks;
