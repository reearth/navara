/**
 * A Map with a maximum capacity that evicts the least-recently used entries.
 *
 * Both `get` and `set` refresh the entry's position, making it the most recent.
 * When the map exceeds `maxSize`, the least-recently used entries are evicted.
 */
export class LRUMap<K, V> {
  private _map = new Map<K, V>();
  private _maxSize: number;

  constructor(maxSize: number) {
    this._maxSize = maxSize;
  }

  get size(): number {
    return this._map.size;
  }

  has(key: K): boolean {
    return this._map.has(key);
  }

  get(key: K): V | undefined {
    const value = this._map.get(key);
    if (value !== undefined) {
      // Touch: move to end (most recently used)
      this._map.delete(key);
      this._map.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    // Delete first so re-insertion moves it to the end (most recent)
    if (this._map.has(key)) {
      this._map.delete(key);
    }

    this._map.set(key, value);

    // Evict oldest entries if over capacity
    while (this._map.size > this._maxSize) {
      const oldest = this._map.keys().next();
      if (!oldest.done) {
        this._map.delete(oldest.value);
      }
    }
  }

  delete(key: K): boolean {
    return this._map.delete(key);
  }

  clear(): void {
    this._map.clear();
  }
}
