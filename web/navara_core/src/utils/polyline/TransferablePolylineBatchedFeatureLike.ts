import type {
  CRS,
  ReturnedTransferablePolylineBatchedFeature,
  TransferablePolylineBatchedFeature,
} from "@navara/engine";

export class TransferablePolylineBatchedFeatureLike
  implements TransferablePolylineBatchedFeature
{
  points: Float32Array;
  points_sizes: Uint32Array;
  batch_ids: Uint32Array;
  crs: CRS;
  length: number;

  constructor(t: ReturnedTransferablePolylineBatchedFeature) {
    this.points = t.transferPoints();
    this.points_sizes = t.transferPointsSizes();
    this.batch_ids = t.transferBatchIds();
    this.crs = t.crs();
    this.length = t.length();
  }

  setPoints(_byte_length: number, _f: () => void): void {}
  setPointsSizes(_byte_length: number, _f: () => void): void {}
  setBatchIds(_byte_length: number, _f: () => void): void {}

  transferPoints(): Float32Array {
    throw new Error();
  }
  transferPointsSizes(): Uint32Array {
    throw new Error();
  }
  transferBatchIds(): Uint32Array {
    throw new Error();
  }

  free(): void {}
}
