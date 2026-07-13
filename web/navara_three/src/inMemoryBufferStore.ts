/**
 * JS-side companion to the WASM `BufferStore`'s `External` entries: holds the
 * real typed-array bytes for handles that WASM tracks by byte count only,
 * keeping fetched pbf / worker-built geometry out of WASM linear memory (which
 * never shrinks). The lifecycle is Rust-driven — handles are issued by
 * `Core.newExternalBuffer` and evicted via `drainRemovedExternalHandles`, so
 * there is no LRU here.
 */
type StoredArray = Uint8Array | Uint32Array | Float32Array | Float64Array;

export class InMemoryBufferStore {
  private _map = new Map<number, StoredArray>();
  private _totalBytes = 0;

  /** Bytes currently held across all entries. */
  get totalBytes(): number {
    return this._totalBytes;
  }

  /** Number of entries currently held. */
  get count(): number {
    return this._map.size;
  }

  /**
   * Store `array` under `handle`. Replacing an existing handle re-accounts its
   * bytes so `totalBytes` never drifts.
   */
  set(handle: number, array: StoredArray): void {
    const old = this._map.get(handle);
    if (old) {
      this._totalBytes -= old.byteLength;
    }
    this._map.set(handle, array);
    this._totalBytes += array.byteLength;
  }

  /** Read an entry without removing it, or `undefined` if absent. */
  get(handle: number): StoredArray | undefined {
    return this._map.get(handle);
  }

  /** Remove and return an entry, transferring ownership to the caller. */
  take(handle: number): StoredArray | undefined {
    const array = this._map.get(handle);
    if (array) {
      this._map.delete(handle);
      this._totalBytes -= array.byteLength;
    }
    return array;
  }

  /** Drop an entry. A no-op for a handle that is not present. */
  delete(handle: number): void {
    const array = this._map.get(handle);
    if (array) {
      this._map.delete(handle);
      this._totalBytes -= array.byteLength;
    }
  }

  /** Drop every entry (called on view dispose). */
  clear(): void {
    this._map.clear();
    this._totalBytes = 0;
  }
}
