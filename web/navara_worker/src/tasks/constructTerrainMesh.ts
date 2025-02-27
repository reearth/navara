import type {
  TransferableMartiniLike,
  TransferableTileLike,
  TransferableRasterDEMDataLike,
  ReturnedConstructedTerrainMeshLike,
} from "@navara/core";
import { constructTerrainMesh as constructTerrainMeshImpl } from "@navara/engine-worker";

import { transfer } from "..";
import { transferReturnedConstructedTerrainMesh } from "../helpers/transferReturnedConstructedTerrainMesh";
import { toTransferableMartini, toTransferableTile } from "../utils";
import { toTransferableRasterDEMDataLike } from "../utils/toTransferableRasterDEMDataLike";

import { waitWasm } from "./waitWasm";

export async function constructTerrainMesh(
  bytes: Uint8Array,
  tile: TransferableTileLike,
  rasterDEMData: TransferableRasterDEMDataLike,
  martini: TransferableMartiniLike,
): Promise<{
  result: ReturnedConstructedTerrainMeshLike;
}> {
  await waitWasm();

  const mesh = constructTerrainMeshImpl(
    bytes,
    toTransferableTile(tile),
    toTransferableRasterDEMDataLike(rasterDEMData),
    toTransferableMartini(martini),
  );
  const { result, transfers } = transferReturnedConstructedTerrainMesh(mesh);
  mesh.drop();
  return transfer({ result }, [...transfers]);
}
