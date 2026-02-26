import type { TransferableRasterDEMDataLike } from "@navara/core";
import {
  ElevationDecoder,
  TransferableRasterDEMData,
} from "@navara/engine-worker";

export function toTransferableRasterDEMDataLike(
  like: TransferableRasterDEMDataLike,
) {
  return new TransferableRasterDEMData(
    new ElevationDecoder(
      like.decoder.r_scaler,
      like.decoder.g_scaler,
      like.decoder.b_scaler,
      like.decoder.offset,
      like.decoder.max_offset,
      like.decoder.min_offset,
      like.decoder.boundary,
      like.decoder.epsilon,
    ),
  );
}
