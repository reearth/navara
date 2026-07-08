import { constructPolygonBatchedFeature } from "./constructPolygonBatchedFeature";
import { constructPolylineBatchedFeature } from "./constructPolylineBatchedFeature";
import { constructQuantizedMeshTerrainMesh } from "./constructQuantizedMeshTerrainMesh";
import { constructTerrainMesh } from "./constructTerrainMesh";
import { getImageDataFromBlob } from "./getImageDataFromBlob";
import { getImageDataFromImageBitmap } from "./getImageDataFromImageBitmap";
import { parseMvtTile } from "./parseMvtTile";
import { upsampleQuantizedMeshTerrainMesh } from "./upsampleQuantizedMeshTerrainMesh";
import { upsampleTerrainMesh } from "./upsampleTerrainMesh";
import { getWasmMemoryUsage, waitWasm } from "./waitWasm";

/** Pre-warm worker by initializing WASM module */
export async function warmUp(): Promise<void> {
  await waitWasm();
}

export const commonTasks = {
  constructTerrainMesh,
  constructQuantizedMeshTerrainMesh,
  upsampleTerrainMesh,
  upsampleQuantizedMeshTerrainMesh,
  getImageDataFromImageBitmap,
  getImageDataFromBlob,
  constructPolygonBatchedFeature,
  constructPolylineBatchedFeature,
  parseMvtTile,
  warmUp,
  getWasmMemoryUsage,
};

export type CommonTasks = typeof commonTasks;
