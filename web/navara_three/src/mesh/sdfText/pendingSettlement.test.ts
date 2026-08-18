import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PendingSettlement } from "./pendingSettlement";

/** Drains several microtask ticks so chained `.then` callbacks have run. */
const flushMicrotasks = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe("PendingSettlement", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves immediately when nothing is in flight", async () => {
    const s = new PendingSettlement();
    let settled = false;
    void s.whenSettled(1000).then(() => (settled = true));
    await flushMicrotasks();
    expect(settled).toBe(true);
  });

  it("waits for a tracked promise to resolve", async () => {
    const s = new PendingSettlement();
    let resolveOp!: () => void;
    s.track(new Promise<void>((r) => (resolveOp = r)));

    let settled = false;
    void s.whenSettled(1000).then(() => (settled = true));
    await flushMicrotasks();
    expect(settled).toBe(false);

    resolveOp();
    await flushMicrotasks();
    expect(settled).toBe(true);
  });

  it("counts a rejected promise as settled", async () => {
    const s = new PendingSettlement();
    let rejectOp!: (e: Error) => void;
    s.track(new Promise<void>((_, rj) => (rejectOp = rj)));

    let settled = false;
    void s.whenSettled(1000).then(() => (settled = true));

    rejectOp(new Error("prepare failed"));
    await flushMicrotasks();
    expect(settled).toBe(true);
  });

  it("waits for the last of several tracked promises", async () => {
    const s = new PendingSettlement();
    const resolvers: (() => void)[] = [];
    for (let i = 0; i < 3; i++) {
      s.track(new Promise<void>((r) => resolvers.push(r)));
    }

    let settled = false;
    void s.whenSettled(1000).then(() => (settled = true));

    resolvers[0]();
    resolvers[1]();
    await flushMicrotasks();
    expect(settled).toBe(false);

    resolvers[2]();
    await flushMicrotasks();
    expect(settled).toBe(true);
  });

  it("resolves at the timeout when an operation never settles", async () => {
    const s = new PendingSettlement();
    s.track(new Promise<void>(() => {}));

    let settled = false;
    void s.whenSettled(1000).then(() => (settled = true));

    await vi.advanceTimersByTimeAsync(999);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
  });

  // A timed-out waiter used to stay queued forever when its operation never
  // settled, so repeated calls grew the queue without bound and a late settle
  // still invoked every one of them.
  it("drops timed-out waiters instead of queueing them forever", async () => {
    const s = new PendingSettlement();
    s.track(new Promise<void>(() => {}));

    for (let i = 0; i < 5; i++) {
      void s.whenSettled(1000);
      await vi.advanceTimersByTimeAsync(1000);
    }

    // Private, but the leak is only observable here — the queue is the bug.
    const waiters = (s as unknown as { _waiters: unknown[] })._waiters;
    expect(waiters.length).toBe(0);
  });

  it("completes once when a settle races the timeout", async () => {
    const s = new PendingSettlement();
    let resolveOp!: () => void;
    s.track(new Promise<void>((r) => (resolveOp = r)));

    let count = 0;
    void s.whenSettled(1000).then(() => count++);

    // Time out first, then let the operation settle afterwards.
    await vi.advanceTimersByTimeAsync(1000);
    expect(count).toBe(1);

    resolveOp();
    await flushMicrotasks();
    expect(count).toBe(1);

    // The settle still drained the queue, so a fresh call resolves at once.
    let after = false;
    void s.whenSettled(1000).then(() => (after = true));
    await flushMicrotasks();
    expect(after).toBe(true);
  });

  it("supports waiters registered across separate settle cycles", async () => {
    const s = new PendingSettlement();

    let resolveA!: () => void;
    s.track(new Promise<void>((r) => (resolveA = r)));
    let firstSettled = false;
    void s.whenSettled(1000).then(() => (firstSettled = true));
    resolveA();
    await flushMicrotasks();
    expect(firstSettled).toBe(true);

    let resolveB!: () => void;
    s.track(new Promise<void>((r) => (resolveB = r)));
    let secondSettled = false;
    void s.whenSettled(1000).then(() => (secondSettled = true));
    await flushMicrotasks();
    expect(secondSettled).toBe(false);

    resolveB();
    await flushMicrotasks();
    expect(secondSettled).toBe(true);
  });
});
