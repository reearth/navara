import type { TransferableMartini } from "@navara/engine";

import type { RemoveFreeRecursively } from "../types";

export class TransferableMartiniLike implements RemoveFreeRecursively<TransferableMartini> {
  coords: Uint32Array;
  size: number;

  constructor(coords: Uint32Array, size: number) {
    this.coords = coords;
    this.size = size;
  }

  transfer_coords(): Uint32Array {
    return this.coords;
  }

  clone() {
    return new TransferableMartiniLike(this.coords.slice(), this.size);
  }
}
