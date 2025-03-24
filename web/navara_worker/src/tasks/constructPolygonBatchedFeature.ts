import {
  PolygonMaterialLike,
  TransferablePolygonBatchedFeatureLike,
  ConstructedPolygonGeometryLike,
} from "@navara/core";
import { constructPolygonBatchedFeature as constructPolygonBatchedFeatureImpl } from "@navara/engine-worker";

import { transfer } from "..";
import { transferConstructedPolygonGeometry } from "../helpers/transferConstructedPolygonGeometry";
import { toPolygonMaterialLike } from "../utils/toPolygonMaterialLike";
import { toTransferablePolygonBatchedFeatureLike } from "../utils/toTransferablePolygonBatchedFeatureLike";

import { waitWasm } from "./waitWasm";

export async function constructPolygonBatchedFeature(
  transferableBatchedFeatureLike: TransferablePolygonBatchedFeatureLike,
  materialLike: PolygonMaterialLike,
): Promise<ConstructedPolygonGeometryLike | undefined> {
  await waitWasm();

  const geometry = constructPolygonBatchedFeatureImpl(
    toTransferablePolygonBatchedFeatureLike(transferableBatchedFeatureLike),
    toPolygonMaterialLike(materialLike),
  );

  if (!geometry) {
    return;
  }

  const { result, transfers } = transferConstructedPolygonGeometry(geometry);
  geometry.free();

  return transfer(result, transfers);
}
