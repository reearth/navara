import type {
  ElevationDecoder,
  TransferableRasterDEMData,
} from "@navara/engine";

export class TransferableRasterDEMDataLike
  implements TransferableRasterDEMData
{
  decoder: ElevationDecoder;

  constructor(decoder: ElevationDecoder) {
    this.decoder = new ElevationDecoderLike(decoder);
  }

  free(): void {}
}

export class ElevationDecoderLike implements ElevationDecoder {
  b_scaler: number;
  boundary: number;
  epsilon: number;
  g_scaler: number;
  max_offset: number;
  min_offset: number;
  offset: number;
  r_scaler: number;

  constructor(t: ElevationDecoder) {
    this.b_scaler = t.b_scaler;
    this.boundary = t.boundary;
    this.epsilon = t.epsilon;
    this.g_scaler = t.g_scaler;
    this.max_offset = t.max_offset;
    this.min_offset = t.min_offset;
    this.offset = t.offset;
    this.r_scaler = t.r_scaler;
  }

  free(): void {}
}
