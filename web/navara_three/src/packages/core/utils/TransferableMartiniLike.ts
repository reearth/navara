import type { TransferableMartini } from "@navara/engine";

const MARTINI_CACHE = new Map<string, Uint32Array>();

export class TransferableMartiniLike implements TransferableMartini {
  coords: Uint32Array<ArrayBufferLike>;
  size: number;

  constructor(t: TransferableMartini) {
    const size = t.size;
    let coords = MARTINI_CACHE.get(size.toString());
    if (!coords) {
      coords = t.coords;
      MARTINI_CACHE.set(size.toString(), coords);
    }
    this.coords = coords;
    this.size = size;
    t.free();
  }

  free(): void {}
}
