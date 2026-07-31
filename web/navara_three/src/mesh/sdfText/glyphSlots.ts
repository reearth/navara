/**
 * Suballocator for the glyph-instance array of a batched text mesh.
 *
 * Every label owns one contiguous run of instance slots, so a text change
 * rewrites only that run (one `addUpdateRange` on each instance attribute)
 * instead of the whole buffer. Runs are rounded up to power-of-two size
 * classes, which is what makes the common case free: re-shaping a label to a
 * similar length ({@link realloc}) keeps the same `start`, so the caller
 * overwrites in place and marks the leftover tail as empty slots.
 *
 * Freed runs go back to a per-class free list and are handed out again before
 * the high-water mark advances. Worst-case internal fragmentation is 2x, which
 * is the price of never having to relocate a run that merely changed length.
 */

/** Smallest run handed out: one background quad plus a few glyphs. Below this
 *  the size classes churn without saving meaningful memory. */
const MIN_RUN_CAPACITY = 4;

/** A label's contiguous span of glyph-instance slots. */
export type GlyphRun = {
  /** First instance index owned by the label. */
  readonly start: number;
  /** Slots reserved — always >= the glyph count the run was sized for. */
  readonly capacity: number;
};

/** Capacity class for `count` slots: the next power of two, floored at
 *  {@link MIN_RUN_CAPACITY}. Exported for tests. */
export function capacityFor(count: number): number {
  if (count <= MIN_RUN_CAPACITY) return MIN_RUN_CAPACITY;
  // 2^ceil(log2(count)), computed without floating-point log to stay exact for
  // the large counts a pathological label could reach.
  let capacity = MIN_RUN_CAPACITY;
  while (capacity < count) capacity *= 2;
  return capacity;
}

export class GlyphSlotAllocator {
  /** Free run starts, keyed by capacity. Each list holds runs of exactly that
   *  capacity, so a request is served without searching. */
  private _free = new Map<number, number[]>();
  private _highWater = 0;

  /**
   * One past the highest slot ever allocated — the value to assign to
   * `geometry.instanceCount`. Slots below it that no label owns are holes and
   * must be filled with empty-kind instances by the caller.
   */
  get highWater(): number {
    return this._highWater;
  }

  /** Reserve a run large enough for `count` glyph instances. */
  alloc(count: number): GlyphRun {
    const capacity = capacityFor(count);

    const pool = this._free.get(capacity);
    const reused = pool?.pop();
    if (reused !== undefined) {
      return { start: reused, capacity };
    }

    const start = this._highWater;
    this._highWater += capacity;
    return { start, capacity };
  }

  /** Return a run to its size class's free list. */
  free(run: GlyphRun): void {
    let pool = this._free.get(run.capacity);
    if (!pool) {
      pool = [];
      this._free.set(run.capacity, pool);
    }
    pool.push(run.start);
  }

  /**
   * Resize a label's run to hold `count` glyphs.
   *
   * Returns the **same run** whenever `count` still fits its capacity class —
   * the case that makes in-place text updates cheap. Otherwise the old run is
   * freed and a new one allocated, and the caller must rewrite the run's
   * attribute data at the new `start`.
   */
  realloc(run: GlyphRun | null, count: number): GlyphRun {
    if (run && capacityFor(count) === run.capacity) return run;
    if (run) this.free(run);
    return this.alloc(count);
  }

  /** Drop all bookkeeping. The caller is responsible for the backing buffers. */
  reset(): void {
    this._free.clear();
    this._highWater = 0;
  }
}
