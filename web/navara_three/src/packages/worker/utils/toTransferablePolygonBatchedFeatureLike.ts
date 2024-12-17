import type { TransferablePolygonBatchedFeatureLike } from "@navara/core";
import { TransferablePolygonBatchedFeature } from "@navara/engine-worker";

export function toTransferablePolygonBatchedFeatureLike(
  like: TransferablePolygonBatchedFeatureLike,
) {
  return new TransferablePolygonBatchedFeature(
    like.outer_ring,
    like.outer_ring_sizes,
    like.holes,
    like.holes_total_sizes,
    like.holes_sizes,
    like.holes_boundaries,
    like.batch_ids,
    like.expected_winding_orders,
    like.crs,
    like.length,
  );
}
