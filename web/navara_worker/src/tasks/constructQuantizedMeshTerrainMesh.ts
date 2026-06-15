import type {
  ReturnedConstructedTerrainMeshLike,
  TransferableTileLike,
} from "@navara/core";
import { constructQuantizedMeshTerrainMesh as constructQuantizedMeshTerrainMeshImpl } from "@navara/engine-worker";

import { transfer } from "..";
import { transferReturnedConstructedTerrainMesh } from "../helpers/transferReturnedConstructedTerrainMesh";
import { toTransferableTile } from "../utils";

import { waitWasm } from "./waitWasm";

export async function constructQuantizedMeshTerrainMesh(
  bytes: Uint8Array,
  tile: TransferableTileLike,
  skirt: boolean,
  skirtExaggeration: number,
  geographic: boolean,
  tms: boolean,
): Promise<{
  result: ReturnedConstructedTerrainMeshLike;
}> {
  await waitWasm();

  const mesh = constructQuantizedMeshTerrainMeshImpl(
    bytes,
    toTransferableTile(tile),
    skirt,
    skirtExaggeration,
    geographic,
    tms,
  );
  const { result, transfers } = transferReturnedConstructedTerrainMesh(mesh);
  mesh.free();
  return transfer({ result }, [...transfers]);
}
