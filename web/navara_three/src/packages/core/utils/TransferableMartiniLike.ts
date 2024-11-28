import type { TransferableMartini } from "@navara/engine";

export class TransferableMartiniLike implements TransferableMartini {
  coords: Uint32Array;
  size: number;

  constructor(t: TransferableMartini) {
    this.coords = t.coords;
    this.size = t.size;
    t.free();
  }

  free(): void {}
}
