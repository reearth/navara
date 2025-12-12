import {
  ReturnedConstructedTerrainMeshLike,
  TransferableRasterDEMDataLike,
  TransferableTileLike,
  UpsamplableTerrainGeometryLike,
} from "@navara/core";
import { upsampleTerrainMesh as upsampleTerrainMeshImpl } from "@navara/engine-worker";

import { transfer } from "..";
import { transferReturnedConstructedTerrainMesh } from "../helpers/transferReturnedConstructedTerrainMesh";
import { toTransferableTile, toUpsamplableTerrainGeometry } from "../utils";
import { toTransferableRasterDEMDataLike } from "../utils/toTransferableRasterDEMDataLike";

import { waitWasm } from "./waitWasm";

export async function upsampleTerrainMesh(
  tile: TransferableTileLike,
  parentTile: TransferableTileLike,
  rasterDEMData: TransferableRasterDEMDataLike,
  upsamplableGeometry: UpsamplableTerrainGeometryLike,
  skirt: boolean,
  skirtExaggeration: number,
): Promise<ReturnedConstructedTerrainMeshLike> {
  await waitWasm();

  const mesh = upsampleTerrainMeshImpl(
    toTransferableTile(tile),
    toTransferableTile(parentTile),
    toTransferableRasterDEMDataLike(rasterDEMData),
    toUpsamplableTerrainGeometry(upsamplableGeometry),
    skirt,
    skirtExaggeration,
  );
  const { result, transfers } = transferReturnedConstructedTerrainMesh(mesh);
  mesh.free();

  return transfer(result, transfers);
}
