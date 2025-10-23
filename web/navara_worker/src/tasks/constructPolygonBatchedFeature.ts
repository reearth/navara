import {
  PolygonMaterialLike,
  TransferablePolygonBatchedFeatureLike,
  ConstructedPolygonGeometryLike,
  ExtentRadianF32Like,
} from "@navara/core";
import { constructPolygonBatchedFeature as constructPolygonBatchedFeatureImpl } from "@navara/engine-worker";

import { transfer } from "..";
import { transferConstructedPolygonGeometry } from "../helpers/transferConstructedPolygonGeometry";
import { toExtentRadianF32Like } from "../utils";
import { toPolygonMaterialLike } from "../utils/toPolygonMaterialLike";
import { toTransferablePolygonBatchedFeatureLike } from "../utils/toTransferablePolygonBatchedFeatureLike";

import { waitWasm } from "./waitWasm";

export async function constructPolygonBatchedFeature(
  transferableBatchedFeatureLike: TransferablePolygonBatchedFeatureLike,
  materialLike: PolygonMaterialLike,
  flat: boolean,
  tile_extent: ExtentRadianF32Like | undefined,
): Promise<ConstructedPolygonGeometryLike | undefined> {
  await waitWasm();

  const geometry = constructPolygonBatchedFeatureImpl(
    toTransferablePolygonBatchedFeatureLike(transferableBatchedFeatureLike),
    toPolygonMaterialLike(materialLike),
    flat,
    tile_extent ? toExtentRadianF32Like(tile_extent) : undefined,
  );

  if (!geometry) {
    return;
  }

  const { result, transfers } = transferConstructedPolygonGeometry(geometry);
  geometry.free();

  return transfer(result, transfers);
}
