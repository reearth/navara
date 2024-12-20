import {
  TransferablePolylineBatchedFeatureLike,
  PolylineMaterialLike,
  ConstructedPolylineGeometryLike,
} from "@navara/core";
import { constructPolylineBatchedFeature as constructPolylineBatchedFeatureImpl } from "@navara/engine-worker";

import { transferConstructedPolylineGeometry } from "../helpers/transferConstructedPolylineGeometry";
import { toPolylineMaterialLike } from "../utils/toPolylineMaterialLike";
import { toTransferablePolylineBatchedFeatureLike } from "../utils/toTransferablePolylineBatchedFeatureLike";
import { transfer } from "../worker";

import { waitWasm } from "./waitWasm";

export async function constructPolylineBatchedFeature(
  transferableBatchedFeatureLike: TransferablePolylineBatchedFeatureLike,
  materialLike: PolylineMaterialLike,
): Promise<ConstructedPolylineGeometryLike | undefined> {
  await waitWasm();

  const geometry = constructPolylineBatchedFeatureImpl(
    toTransferablePolylineBatchedFeatureLike(transferableBatchedFeatureLike),
    toPolylineMaterialLike(materialLike),
  );

  if (!geometry) {
    return;
  }

  const { result, transfers } = transferConstructedPolylineGeometry(geometry);

  return transfer(result, transfers);
}
