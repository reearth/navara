import {
  PolylineMaterialLike,
  TransferablePolylineBatchedFeatureLike,
} from "@navara/core";
import type { ConstructedPolylineGeometry } from "@navara/engine";

import { queueTask } from "./queueTask";

export async function constructPolylineBatchedFeature(
  transferableBatchedFeatureLike: TransferablePolylineBatchedFeatureLike,
  materialLike: PolylineMaterialLike,
): Promise<ConstructedPolylineGeometry | undefined> {
  const result = await queueTask(
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
  return result;
}
