import type { TransferableMartini } from "@navara/engine";

// MARTINI precomputes `coords` because the calculation is heavy.
// But the number of items of `coords` is over ten thousand, so it's huge data. And reading `coords` from WASM is too slow.
// Fortunately, `coords` is precomputed by each size of tile, so it will be same if the size is same.
// So we can cache it by `size`.
const MARTINI_CACHE = new Map<number, Uint32Array>();

export class TransferableMartiniLike implements TransferableMartini {
  coords: Uint32Array<ArrayBufferLike>;
  size: number;

  constructor(t: TransferableMartini) {
    const size = t.size;
    let coords = MARTINI_CACHE.get(size);
    if (!coords) {
      coords = t.coords;
      MARTINI_CACHE.set(size, coords);
    }
    this.coords = coords;
    this.size = size;
    t.free();
  }

  free(): void {}
}
