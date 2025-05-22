import type {
  TransferableTileLike,
  TransferableRasterDEMDataLike,
  ReturnedConstructedTerrainMeshLike,
} from "@navara/core";
import {
  constructTerrainMesh as constructTerrainMeshImpl,
  TransferableMartini,
} from "@navara/engine-worker";

import { transfer } from "..";
import { transferReturnedConstructedTerrainMesh } from "../helpers/transferReturnedConstructedTerrainMesh";
import { toTransferableTile } from "../utils";
import { toTransferableRasterDEMDataLike } from "../utils/toTransferableRasterDEMDataLike";

import { waitWasm } from "./waitWasm";

export async function constructTerrainMesh(
  bytes: Uint8Array,
  tile: TransferableTileLike,
  rasterDEMData: TransferableRasterDEMDataLike,
  size: number,
): Promise<{
  result: ReturnedConstructedTerrainMeshLike;
}> {
  await waitWasm();

  const tileSizeWithBoundary = size + 1;
  const martini = TransferableMartini.fromSize(tileSizeWithBoundary);

  const mesh = constructTerrainMeshImpl(
    bytes,
    toTransferableTile(tile),
    toTransferableRasterDEMDataLike(rasterDEMData),
    martini,
  );
  const { result, transfers } = transferReturnedConstructedTerrainMesh(mesh);
  mesh.free();
  return transfer({ result }, [...transfers]);
}
