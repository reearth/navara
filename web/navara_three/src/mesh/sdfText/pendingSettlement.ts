/**
 * Counts in-flight async operations and lets callers await the moment the
 * count returns to zero, bounded by a timeout.
 *
 * Used to defer a text batch's render-completion report until its labels'
 * async font preparations have landed: the report drives the Rust tile-LOD
 * swap, and reporting while glyph runs are still being shaped swaps a parent
 * tile out for a child that draws nothing (a tile-shaped blank).
 */
export class PendingSettlement {
  private _pending = 0;
  private _waiters: (() => void)[] = [];

  get pending(): number {
    return this._pending;
  }

  /** Track an in-flight operation. Rejection counts as settled too — a failed
   *  font prepare must not hold the LOD swap hostage. */
  track(p: Promise<unknown>): void {
    this._pending++;
    const done = () => {
      this._pending--;
      if (this._pending === 0) {
        const waiters = this._waiters;
        this._waiters = [];
        for (const w of waiters) w();
      }
    };
    p.then(done, done);
  }

  /**
   * Resolves once nothing tracked is in flight, or after `timeoutMs`,
   * whichever comes first. Only operations already tracked when this is
   * called are waited on (plus any tracked before the count next reaches
   * zero); resolves immediately when already settled.
   */
  whenSettled(timeoutMs: number): Promise<void> {
    if (this._pending === 0) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, timeoutMs);
      this._waiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}
