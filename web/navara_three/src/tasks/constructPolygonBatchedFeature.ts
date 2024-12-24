import {
  ConstructedPolygonGeometryLike,
  PolygonMaterialLike,
  TransferablePolygonBatchedFeatureLike,
} from "@navara/core";

import { queueTask } from "./queueTask";

export async function constructPolygonBatchedFeature(
  transferableBatchedFeatureLike: TransferablePolygonBatchedFeatureLike,
  materialLike: PolygonMaterialLike,
): Promise<ConstructedPolygonGeometryLike | undefined> {
  const result = await queueTask(
    "constructPolygonBatchedFeature",
    [transferableBatchedFeatureLike, materialLike],
    {
      transfer: [
        transferableBatchedFeatureLike.batch_ids.buffer,
        transferableBatchedFeatureLike.expected_winding_orders.buffer,
        transferableBatchedFeatureLike.holes.buffer,
        transferableBatchedFeatureLike.holes_boundaries.buffer,
        transferableBatchedFeatureLike.holes_sizes.buffer,
        transferableBatchedFeatureLike.holes_total_sizes.buffer,
        transferableBatchedFeatureLike.outer_ring.buffer,
        transferableBatchedFeatureLike.outer_ring_sizes.buffer,
      ],
    },
  );
  return result;
}
