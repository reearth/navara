import type {
  DelegatedWorkerTasksResult,
  ReconstructableEntity,
} from "@navaramap/engine";

import type { WorkerPoolPromise } from "../type";

import type { EventContext } from "./context";

/**
 * How a worker-pool task ended. Cancellation (tile/feature evicted while the
 * task was queued or running) is a routine outcome under camera movement, not
 * an error: it must never surface as a rejection to the event pipeline.
 */
export type WorkerTaskSettlement<T> =
  | { status: "completed"; value: T }
  | { status: "cancelled" }
  | { status: "failed"; error: unknown };

function isCancellation(err: unknown): boolean {
  return err instanceof Error && err.name === "CancellationError";
}

/**
 * Own the workerPoolPromises lifecycle around one pool task: register the
 * promise (so a removal event can cancel it), classify the outcome, and
 * always unregister.
 */
export async function settleWorkerTask<T>(
  ctx: Pick<EventContext, "workerPoolPromises">,
  id: string,
  promise: WorkerPoolPromise<T>,
): Promise<WorkerTaskSettlement<T>> {
  ctx.workerPoolPromises.set(id, promise);
  try {
    return { status: "completed", value: await promise };
  } catch (error) {
    return isCancellation(error)
      ? { status: "cancelled" }
      : { status: "failed", error };
  } finally {
    // Only delete our own entry: a new task could in principle reuse the id
    // between a cancel and this continuation.
    if (ctx.workerPoolPromises.get(id) === promise) {
      ctx.workerPoolPromises.delete(id);
    }
  }
}

/** Helpers handed to a delegated-task body by {@link runDelegatedWorkerTask}. */
export type DelegatedTaskHandle = {
  /**
   * Register + await one pool task via {@link settleWorkerTask} and classify
   * the outcome: the settled value on completion, `undefined` otherwise. A
   * failure is logged (as `Failed to <label> in worker:`) and `onFailed` runs
   * before returning, so a task kind can substitute its own failure
   * completion (e.g. the MVT parse completes with an empty result).
   */
  settle<T>(
    promise: WorkerPoolPromise<T>,
    onFailed?: () => void,
  ): Promise<T | undefined>;
  /**
   * Deliver the task result to the engine. `build` receives ownership of
   * `delegator_id` (the `DelegatedWorkerTasksResult.with*` constructors
   * consume it).
   */
  complete(
    build: (delegator_id: ReconstructableEntity) => DelegatedWorkerTasksResult,
  ): void;
};

/**
 * Shared scaffolding around one delegated worker task: own the wasm-bindgen
 * boundary objects (`params` is freed on every path; `delegator_id` is
 * consumed exactly once) and guarantee the delegator always settles. A body
 * that returns without calling `complete` — worker failure, missing input,
 * buffer registration failure, or an unexpected throw — releases the
 * delegator through `triggerWorkerTaskFailed`; otherwise it would stay
 * Requested forever and permanently occupy one of the engine's pending
 * dispatch slots for its task kind. For a task the engine already cancelled
 * the release is a no-op on the Rust side, so cancellations need no special
 * casing here.
 */
export async function runDelegatedWorkerTask<P extends { free(): void }>(
  ctx: Pick<EventContext, "workerPoolPromises" | "workerTaskHandler">,
  id: string,
  bits: bigint,
  label: string,
  params: P,
  delegator_id: ReconstructableEntity,
  body: (task: DelegatedTaskHandle) => Promise<void>,
): Promise<void> {
  let delegatorSettled = false;
  const task: DelegatedTaskHandle = {
    async settle(promise, onFailed) {
      const settled = await settleWorkerTask(ctx, id, promise);
      if (settled.status === "completed") {
        return settled.value;
      }
      if (settled.status === "failed") {
        console.error(`Failed to ${label} in worker:`, settled.error);
        onFailed?.();
      }
      return undefined;
    },
    complete(build) {
      // Flag before building so a throw inside `build` (after `with*` already
      // consumed `delegator_id`) cannot lead to a double free below.
      delegatorSettled = true;
      ctx.workerTaskHandler.triggerWorkerTaskCompleted(
        bits,
        build(delegator_id),
      );
    },
  };
  try {
    await body(task);
  } catch (error) {
    console.error(`Failed to ${label}:`, error);
  } finally {
    params.free();
    if (!delegatorSettled) {
      // Consumes `delegator_id`.
      ctx.workerTaskHandler.triggerWorkerTaskFailed(delegator_id);
    }
  }
}
