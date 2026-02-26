import type {
  CRS,
  ReturnedTransferablePolylineBatchedFeature,
  TransferablePolylineBatchedFeature,
} from "@navara/engine";

import type { RemoveFreeRecursively } from "../../types";

export class TransferablePolylineBatchedFeatureLike
  implements RemoveFreeRecursively<TransferablePolylineBatchedFeature>
{
  points: Float64Array;
  points_sizes: Uint32Array;
  batch_ids: Uint32Array;
  batch_indices: Uint32Array;
  crs: CRS;
  length: number;

  constructor(t: ReturnedTransferablePolylineBatchedFeature) {
    this.points = t.transferPoints();
    this.points_sizes = t.transferPointsSizes();
    this.batch_ids = t.transferBatchIds();
    this.batch_indices = t.transferBatchIndices();
    this.crs = t.crs();
    this.length = t.length();
  }

  setPoints(_byte_length: number, _f: () => void): void {}
  setPointsSizes(_byte_length: number, _f: () => void): void {}
  setBatchIds(_byte_length: number, _f: () => void): void {}
  setBatchIndices(_length: number, _f: () => void) {}

  transferPoints(): Float64Array {
    throw new Error();
  }
  transferPointsSizes(): Uint32Array {
    throw new Error();
  }
  transferBatchIds(): Uint32Array {
    throw new Error();
  }
  transferBatchIndices(): Uint32Array {
    throw new Error();
  }
}
