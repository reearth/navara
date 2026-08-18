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
   *
   * Settle and timeout are mutually exclusive completion paths, and the
   * timeout drops its own waiter: an operation that never settles would
   * otherwise leave every timed-out waiter queued forever, so repeated calls
   * would grow `_waiters` without bound.
   */
  whenSettled(timeoutMs: number): Promise<void> {
    if (this._pending === 0) return Promise.resolve();
    return new Promise((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        resolve();
      };
      // Declared after `finish` so it can be `const`; `finish` only reads it
      // when invoked, which is always after this assignment.
      const timer = setTimeout(() => {
        this._removeWaiter(finish);
        finish();
      }, timeoutMs);
      this._waiters.push(finish);
    });
  }

  private _removeWaiter(waiter: () => void): void {
    const i = this._waiters.indexOf(waiter);
    if (i !== -1) this._waiters.splice(i, 1);
  }
}
