import { afterEach, beforeEach, expect, it, vi } from "vitest";
import workerpool from "workerpool";
import type Pool from "workerpool/types/Pool";

import {
  RECYCLE_AFTER_TASKS_BACKSTOP,
  RECYCLE_IDLE_MS,
  RecyclingWorkerPool,
} from "./recyclingPool";

type MockExecution = {
  method: string;
  settled: boolean;
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
};

type MockPool = {
  executions: MockExecution[];
  exec: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
  stats: () => ReturnType<Pool["stats"]>;
};

// Every workerpool.pool() call yields a fresh mock, recorded in order so
// tests can distinguish original slot pools from recycled replacements.
let pools: MockPool[] = [];

vi.spyOn(workerpool, "pool").mockImplementation(() => {
  const mock: MockPool = {
    executions: [],
    exec: vi.fn(
      (method: string) =>
        new workerpool.Promise(
          (
            resolve: (value?: unknown) => void,
            reject: (e?: unknown) => void,
          ) => {
            const execution: MockExecution = {
              method,
              settled: false,
              resolve: (value?: unknown) => {
                execution.settled = true;
                resolve(value);
              },
              reject: (e?: unknown) => {
                execution.settled = true;
                reject(e);
              },
            };
            mock.executions.push(execution);
          },
        ),
    ),
    terminate: vi.fn(),
    stats: () => ({
      totalWorkers: 1,
      busyWorkers: 0,
      idleWorkers: 1,
      pendingTasks: 0,
      activeTasks: 0,
    }),
  };
  pools.push(mock);
  return mock as unknown as Pool;
});

beforeEach(() => {
  pools = [];
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const PROBE = "getWasmMemoryUsage";

const nextPending = (pool: MockPool, method: string) =>
  pool.executions.find((e) => e.method === method && !e.settled);

/** Settles the oldest pending "test" task. */
const settleTask = (pool: MockPool) => {
  nextPending(pool, "test")?.resolve();
};

/** Answers the pending heap probe with the given byte count. */
const respondToProbe = (pool: MockPool, bytes: number) => {
  nextPending(pool, PROBE)?.resolve(bytes);
};

it("creates one single-worker pool per slot", () => {
  new RecyclingWorkerPool("https://example.com", 3);
  expect(pools).toHaveLength(3);
  expect(workerpool.pool).toHaveBeenLastCalledWith(
    "https://example.com",
    expect.objectContaining({ maxWorkers: 1, minWorkers: 0 }),
  );
});

it("dispatches tasks to the least-loaded slot", () => {
  const pool = new RecyclingWorkerPool("https://example.com", 2);

  pool.exec("test");
  pool.exec("test");

  expect(pools[0].exec).toHaveBeenCalledTimes(1);
  expect(pools[1].exec).toHaveBeenCalledTimes(1);
});

it("probes heap usage after a settled task and recycles once over budget", async () => {
  const pool = new RecyclingWorkerPool("https://example.com", 1, {
    maxWorkerHeapBytes: 100,
  });

  const task = pool.exec("test");
  settleTask(pools[0]);
  await task;
  expect(nextPending(pools[0], PROBE)).toBeDefined();

  // Under budget: the slot keeps its worker.
  respondToProbe(pools[0], 99);
  expect(pools[0].terminate).not.toHaveBeenCalled();

  // Over budget: the slot recycles and pre-warms the replacement.
  const task2 = pool.exec("test");
  settleTask(pools[0]);
  await task2;
  respondToProbe(pools[0], 100);
  expect(pools[0].terminate).toHaveBeenCalledTimes(1);
  expect(pools).toHaveLength(2);
  expect(pools[1].executions[0]?.method).toBe("warmUp");
});

it("coalesces heap probes", async () => {
  const pool = new RecyclingWorkerPool("https://example.com", 1);

  const task1 = pool.exec("test");
  const task2 = pool.exec("test");
  settleTask(pools[0]);
  await task1;
  settleTask(pools[0]);
  await task2;

  expect(pools[0].executions.filter((e) => e.method === PROBE)).toHaveLength(1);
});

it("recycles conservatively when the heap probe fails", async () => {
  const pool = new RecyclingWorkerPool("https://example.com", 1);

  const task = pool.exec("test");
  settleTask(pools[0]);
  await task;

  nextPending(pools[0], PROBE)?.reject(new Error("worker died"));
  expect(pools[0].terminate).toHaveBeenCalledTimes(1);
  expect(pools[1].executions[0]?.method).toBe("warmUp");
});

it("stops dispatching to a draining slot until it recycles", async () => {
  const pool = new RecyclingWorkerPool("https://example.com", 2, {
    maxWorkerHeapBytes: 100,
  });

  // Two overlapping tasks on the first slot (plus one pinned on the second
  // so in-flight ties keep resolving to the first).
  const first = pool.exec("test");
  pool.exec("test");
  const second = pool.exec("test");

  // Settling one task triggers a probe reporting over budget; the remaining
  // task keeps the slot from recycling immediately.
  settleTask(pools[0]);
  await first;
  respondToProbe(pools[0], 100);
  expect(pools[0].terminate).not.toHaveBeenCalled();

  // The draining slot must not receive new tasks even though it ties the
  // other slot on in-flight count.
  pool.exec("test");
  expect(pools[1].exec).toHaveBeenCalledTimes(2);

  // Once the remaining task settles, the slot recycles and gets warmed.
  settleTask(pools[0]);
  await second;
  expect(pools[0].terminate).toHaveBeenCalledTimes(1);
  expect(pools[2].executions[0]?.method).toBe("warmUp");
});

it("recycles after the task-count backstop even when probes stay under budget", async () => {
  const pool = new RecyclingWorkerPool("https://example.com", 1);

  for (let i = 0; i < RECYCLE_AFTER_TASKS_BACKSTOP; i++) {
    const task = pool.exec("test");
    settleTask(pools[0]);
    await task;
    respondToProbe(pools[0], 1);
  }

  expect(pools[0].terminate).toHaveBeenCalledTimes(1);
  expect(pools[1].executions[0]?.method).toBe("warmUp");
});

it("recycles used slots after the pool goes idle", async () => {
  const pool = new RecyclingWorkerPool("https://example.com", 2);

  const task = pool.exec("test");
  settleTask(pools[0]);
  await task;
  respondToProbe(pools[0], 1);

  vi.advanceTimersByTime(RECYCLE_IDLE_MS);

  // Only the used slot is recycled; the untouched slot keeps its pool.
  expect(pools[0].terminate).toHaveBeenCalledTimes(1);
  expect(pools[1].terminate).not.toHaveBeenCalled();
  expect(pools[2].executions[0]?.method).toBe("warmUp");
  // The warm-up settlement must not re-arm the sweep against fresh slots.
  nextPending(pools[2], "warmUp")?.resolve();
  vi.advanceTimersByTime(RECYCLE_IDLE_MS);
  expect(pools[2].terminate).not.toHaveBeenCalled();
});

it("warmUp() pre-initializes every slot", async () => {
  const pool = new RecyclingWorkerPool("https://example.com", 2);

  const warmed = pool.warmUp();

  expect(pools[0].executions[0]?.method).toBe("warmUp");
  expect(pools[1].executions[0]?.method).toBe("warmUp");
  nextPending(pools[0], "warmUp")?.resolve();
  nextPending(pools[1], "warmUp")?.resolve();
  await warmed;
});

it("reports no capacity while every slot is draining", async () => {
  const pool = new RecyclingWorkerPool("https://example.com", 1, {
    maxWorkerHeapBytes: 100,
  });
  expect(pool.canAcceptTasks()).toBe(true);

  const task1 = pool.exec("test");
  const task2 = pool.exec("test");
  settleTask(pools[0]);
  await task1;
  respondToProbe(pools[0], 100);
  expect(pool.canAcceptTasks()).toBe(false);

  // Recycling restores capacity.
  settleTask(pools[0]);
  await task2;
  expect(pool.canAcceptTasks()).toBe(true);
});

it("terminate() terminates all slots and cancels the idle sweep", async () => {
  const pool = new RecyclingWorkerPool("https://example.com", 2);

  const task = pool.exec("test");
  settleTask(pools[0]);
  await task;

  pool.terminate();
  expect(pools[0].terminate).toHaveBeenCalledTimes(1);
  expect(pools[1].terminate).toHaveBeenCalledTimes(1);

  vi.advanceTimersByTime(RECYCLE_IDLE_MS);
  expect(pools).toHaveLength(2);
});

it("aggregates stats across slots", async () => {
  const pool = new RecyclingWorkerPool("https://example.com", 2);

  const task = pool.exec("test");
  settleTask(pools[0]);
  await task;

  expect(pool.stats()).toEqual({
    totalWorkers: 2,
    busyWorkers: 0,
    idleWorkers: 2,
    pendingTasks: 0,
    activeTasks: 0,
    tasksSinceSpawn: 1,
  });
});
