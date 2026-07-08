import type {
  DelegatedWorkerTasksResult,
  ReconstructableEntity,
} from "@navara/engine";
import { expect, it, vi } from "vitest";


import type { WorkerPoolPromise, WorkerPoolPromises } from "../type";

import {
  runDelegatedWorkerTask,
  settleWorkerTask,
} from "./workerTaskSettlement";

const makeCtx = () => ({ workerPoolPromises: new Map() as WorkerPoolPromises });

const asPoolPromise = <T>(promise: Promise<T>) =>
  promise as unknown as WorkerPoolPromise<T>;

const cancellationError = () => {
  const err = new Error("promise cancelled");
  err.name = "CancellationError";
  return err;
};

it("should register the promise, resolve to completed, and unregister", async () => {
  const ctx = makeCtx();
  let resolve!: (v: string) => void;
  const promise = asPoolPromise(new Promise<string>((r) => (resolve = r)));

  const settling = settleWorkerTask(ctx, "id", promise);
  expect(ctx.workerPoolPromises.get("id")).toBe(promise);

  resolve("value");
  expect(await settling).toEqual({ status: "completed", value: "value" });
  expect(ctx.workerPoolPromises.size).toBe(0);
});

it("should classify a CancellationError as cancelled, not failed", async () => {
  const ctx = makeCtx();
  let reject!: (e: unknown) => void;
  const promise = asPoolPromise(new Promise<void>((_, r) => (reject = r)));

  const settling = settleWorkerTask(ctx, "id", promise);
  reject(cancellationError());

  expect(await settling).toEqual({ status: "cancelled" });
  expect(ctx.workerPoolPromises.size).toBe(0);
});

it("should classify any other rejection as failed with its error", async () => {
  const ctx = makeCtx();
  const error = new Error("worker exploded");
  const settling = settleWorkerTask(
    ctx,
    "id",
    asPoolPromise(Promise.reject(error)),
  );

  expect(await settling).toEqual({ status: "failed", error });
  expect(ctx.workerPoolPromises.size).toBe(0);
});

it("should not delete a map entry that was replaced by a newer task", async () => {
  const ctx = makeCtx();
  let reject!: (e: unknown) => void;
  const promise = asPoolPromise(new Promise<void>((_, r) => (reject = r)));
  const settling = settleWorkerTask(ctx, "id", promise);

  // A newer task reuses the id while the first one is being cancelled.
  const replacement = asPoolPromise(new Promise<void>(() => {}));
  ctx.workerPoolPromises.set("id", replacement);
  reject(cancellationError());

  expect(await settling).toEqual({ status: "cancelled" });
  expect(ctx.workerPoolPromises.get("id")).toBe(replacement);
});

const makeDelegatedCtx = () => ({
  workerPoolPromises: new Map() as WorkerPoolPromises,
  workerTaskHandler: {
    triggerWorkerTaskCompleted: vi.fn(),
    triggerWorkerTaskFailed: vi.fn(),
    hasWorkerTask: vi.fn(() => true),
  },
});

const makeBoundary = () => ({
  params: { free: vi.fn() },
  delegator_id: { free: vi.fn() } as unknown as ReconstructableEntity,
});

it("should deliver a completed result and not release the delegator again", async () => {
  const ctx = makeDelegatedCtx();
  const { params, delegator_id } = makeBoundary();
  const result = { built: true } as unknown as DelegatedWorkerTasksResult;

  await runDelegatedWorkerTask(
    ctx,
    "id",
    1n,
    "test task",
    params,
    delegator_id,
    async (task) => {
      const value = await task.settle(asPoolPromise(Promise.resolve("ok")));
      expect(value).toBe("ok");
      task.complete((id) => {
        expect(id).toBe(delegator_id);
        return result;
      });
    },
  );

  expect(ctx.workerTaskHandler.triggerWorkerTaskCompleted).toHaveBeenCalledWith(
    1n,
    result,
  );
  expect(ctx.workerTaskHandler.triggerWorkerTaskFailed).not.toHaveBeenCalled();
  expect(params.free).toHaveBeenCalledOnce();
});

it("should release the delegator when the body bails out without completing", async () => {
  const ctx = makeDelegatedCtx();
  const { params, delegator_id } = makeBoundary();

  await runDelegatedWorkerTask(
    ctx,
    "id",
    1n,
    "test task",
    params,
    delegator_id,
    async () => {
      // Missing input: bail out without completing.
    },
  );

  expect(ctx.workerTaskHandler.triggerWorkerTaskFailed).toHaveBeenCalledWith(
    delegator_id,
  );
  expect(
    ctx.workerTaskHandler.triggerWorkerTaskCompleted,
  ).not.toHaveBeenCalled();
  expect(params.free).toHaveBeenCalledOnce();
});

it("should contain an unexpected body throw and release the delegator", async () => {
  const ctx = makeDelegatedCtx();
  const { params, delegator_id } = makeBoundary();
  const consoleError = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);

  await runDelegatedWorkerTask(
    ctx,
    "id",
    1n,
    "test task",
    params,
    delegator_id,
    async () => {
      throw new Error("boom");
    },
  );

  expect(consoleError).toHaveBeenCalledOnce();
  expect(ctx.workerTaskHandler.triggerWorkerTaskFailed).toHaveBeenCalledWith(
    delegator_id,
  );
  expect(params.free).toHaveBeenCalledOnce();
  consoleError.mockRestore();
});

it("should log a failed settlement and run onFailed, which can complete instead", async () => {
  const ctx = makeDelegatedCtx();
  const { params, delegator_id } = makeBoundary();
  const empty = { empty: true } as unknown as DelegatedWorkerTasksResult;
  const consoleError = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);

  await runDelegatedWorkerTask(
    ctx,
    "id",
    1n,
    "test task",
    params,
    delegator_id,
    async (task) => {
      const value = await task.settle(
        asPoolPromise(Promise.reject(new Error("worker exploded"))),
        () => task.complete(() => empty),
      );
      expect(value).toBeUndefined();
    },
  );

  expect(consoleError).toHaveBeenCalledWith(
    "Failed to test task in worker:",
    expect.any(Error),
  );
  // `onFailed` completed the task, so the fallback release must not fire.
  expect(ctx.workerTaskHandler.triggerWorkerTaskCompleted).toHaveBeenCalledWith(
    1n,
    empty,
  );
  expect(ctx.workerTaskHandler.triggerWorkerTaskFailed).not.toHaveBeenCalled();
  consoleError.mockRestore();
});

it("should treat a cancellation as a silent release without invoking onFailed", async () => {
  const ctx = makeDelegatedCtx();
  const { params, delegator_id } = makeBoundary();
  const onFailed = vi.fn();
  const consoleError = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);

  await runDelegatedWorkerTask(
    ctx,
    "id",
    1n,
    "test task",
    params,
    delegator_id,
    async (task) => {
      const value = await task.settle(
        asPoolPromise(Promise.reject(cancellationError())),
        onFailed,
      );
      expect(value).toBeUndefined();
    },
  );

  expect(onFailed).not.toHaveBeenCalled();
  expect(consoleError).not.toHaveBeenCalled();
  // The engine already deleted a cancelled task's delegator, so this release
  // is a no-op on the Rust side — but it must still consume `delegator_id`.
  expect(ctx.workerTaskHandler.triggerWorkerTaskFailed).toHaveBeenCalledWith(
    delegator_id,
  );
  consoleError.mockRestore();
});
