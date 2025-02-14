import {
  ConstructedPolylineGeometryLike,
  PolylineMaterialLike,
  TransferablePolylineBatchedFeatureLike,
} from "@navara/core";
import type { Promise } from "@navara/worker";

import { queueTask } from "./queueTask";

export function constructPolylineBatchedFeature(
  transferableBatchedFeatureLike: TransferablePolylineBatchedFeatureLike,
  materialLike: PolylineMaterialLike,
): Promise<ConstructedPolylineGeometryLike | undefined> {
  return queueTask(
    "constructPolylineBatchedFeature",
    [transferableBatchedFeatureLike, materialLike],
    {
      transfer: [
        transferableBatchedFeatureLike.points.buffer,
        transferableBatchedFeatureLike.points_sizes.buffer,
        transferableBatchedFeatureLike.batch_ids.buffer,
      ],
    },
  );
}
