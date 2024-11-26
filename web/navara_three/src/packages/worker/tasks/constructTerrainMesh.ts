import type {
  TransferableMartiniLike,
  TransferableTileLike,
  TransferableRasterDEMDataLike,
  ReturnedConstructedTerrainMeshLike,
} from "@navara/core";
import { constructTerrainMesh as constructTerrainMeshImpl } from "@navara/engine-worker";

import { transferReturnedConstructedTerrainMesh } from "../helpers/transferReturnedConstructedTerrainMesh";
import { toTransferableMartini, toTransferableTile } from "../utils";
import { toTransferableRasterDEMDataLike } from "../utils/toTransferableRasterDEMDataLike";

import { waitWasm } from "./waitWasm";

export async function constructTerrainMesh(
  bytes: Uint8Array,
  tile: TransferableTileLike,
  rasterDEMData: TransferableRasterDEMDataLike,
  martini: TransferableMartiniLike,
): Promise<ReturnedConstructedTerrainMeshLike> {
  await waitWasm();

  const result = constructTerrainMeshImpl(
    bytes,
    toTransferableTile(tile),
    toTransferableRasterDEMDataLike(rasterDEMData),
    toTransferableMartini(martini),
  );
  return transferReturnedConstructedTerrainMesh(result);
}
