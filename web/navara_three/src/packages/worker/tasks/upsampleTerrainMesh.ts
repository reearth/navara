import {
  ReturnedConstructedTerrainMeshLike,
  TransferableRasterDEMDataLike,
  TransferableTileLike,
  UpsamplableTerrainGeometryLike,
} from "@navara/core";
import { upsampleTerrainMesh as upsampleTerrainMeshImpl } from "@navara/engine-worker";

import { transferReturnedConstructedTerrainMesh } from "../helpers/transferReturnedConstructedTerrainMesh";
import { toTransferableTile, toUpsamplableTerrainGeometry } from "../utils";
import { toTransferableRasterDEMDataLike } from "../utils/toTransferableRasterDEMDataLike";
import { transfer } from "../worker";

import { waitWasm } from "./waitWasm";

export async function upsampleTerrainMesh(
  tile: TransferableTileLike,
  parentTile: TransferableTileLike,
  rasterDEMData: TransferableRasterDEMDataLike,
  upsamplableGeometry: UpsamplableTerrainGeometryLike,
): Promise<ReturnedConstructedTerrainMeshLike> {
  await waitWasm();

  const mesh = upsampleTerrainMeshImpl(
    toTransferableTile(tile),
    toTransferableTile(parentTile),
    toTransferableRasterDEMDataLike(rasterDEMData),
    toUpsamplableTerrainGeometry(upsamplableGeometry),
  );
  const { result, transfers } = transferReturnedConstructedTerrainMesh(mesh);

  return transfer(result, transfers);
}
