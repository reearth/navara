import type { TransferableMartini } from "@navara/engine";

export class TransferableMartiniLike implements TransferableMartini {
  coords: Uint32Array<ArrayBufferLike>;
  size: number;

  constructor(t: TransferableMartini) {
    this.coords = t.coords;
    this.size = t.size;
  }

  free(): void {}
}
