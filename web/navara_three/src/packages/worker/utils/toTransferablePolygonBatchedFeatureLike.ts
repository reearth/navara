import type { TransferablePolygonBatchedFeatureLike } from "@navara/core";
import { TransferablePolygonBatchedFeature } from "@navara/engine-worker";

export function toTransferablePolygonBatchedFeatureLike(
  like: TransferablePolygonBatchedFeatureLike,
) {
  const t = new TransferablePolygonBatchedFeature(like.crs, like.length);

  t.setOuterRing(like.outer_ring.length, (b: Float32Array) => {
    b.set(like.outer_ring);
  });
  t.setOuterRingSizes(like.outer_ring_sizes.length, (b: Uint32Array) => {
    b.set(like.outer_ring_sizes);
  });
  t.setHoles(like.holes.length, (b: Float32Array) => {
    b.set(like.holes);
  });
  t.setHolesSizes(like.holes_sizes.length, (b: Uint32Array) => {
    b.set(like.holes_sizes);
  });
  t.setHolesTotalSizes(like.holes_total_sizes.length, (b: Uint32Array) => {
    b.set(like.holes_total_sizes);
  });
  t.setHolesBoundaries(like.holes_boundaries.length, (b: Uint32Array) => {
    b.set(like.holes_boundaries);
  });
  t.setExpectedWindingOrders(
    like.expected_winding_orders.length,
    (b: Uint32Array) => {
      b.set(like.expected_winding_orders);
    },
  );
  t.setBatchIds(like.batch_ids.length, (b: Uint32Array) => {
    b.set(like.batch_ids);
  });
  t.setExtrudedHeights(like.extruded_heights.length, (b: Float32Array) => {
    b.set(like.extruded_heights);
  });

  return t;
}
