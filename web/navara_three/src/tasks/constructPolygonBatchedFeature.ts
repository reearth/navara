import {
  ConstructedPolygonGeometryLike,
  PolygonMaterialLike,
  TransferablePolygonBatchedFeatureLike,
} from "@navara/core";
import type { Promise } from "@navara/worker";

import { queueTask } from "./queueTask";

export function constructPolygonBatchedFeature(
  transferableBatchedFeatureLike: TransferablePolygonBatchedFeatureLike,
  materialLike: PolygonMaterialLike,
  flat: boolean,
): Promise<ConstructedPolygonGeometryLike | undefined> {
  return queueTask(
    "constructPolygonBatchedFeature",
    [transferableBatchedFeatureLike, materialLike, flat],
    {
      transfer: [
        transferableBatchedFeatureLike.batch_ids.buffer,
        transferableBatchedFeatureLike.batch_indices.buffer,
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
}
