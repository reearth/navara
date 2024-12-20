import type { TransferablePolylineBatchedFeatureLike } from "@navara/core";
import { TransferablePolylineBatchedFeature } from "@navara/engine-worker";

export function toTransferablePolylineBatchedFeatureLike(
  like: TransferablePolylineBatchedFeatureLike,
) {
  return new TransferablePolylineBatchedFeature(
    like.points,
    like.points_sizes,
    like.batch_ids,
    like.crs,
    like.length,
  );
}
