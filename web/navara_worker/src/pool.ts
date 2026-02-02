import workerpool, { Promise } from "workerpool";
import type Pool from "workerpool/types/Pool";
import type { ExecOptions } from "workerpool/types/types";

import type { ConcurrencyManager } from "./manager";
import { type CommonTasks } from "./worker";

export type { Promise } from "workerpool";

const { initializeWorkerPool, worker } = (() => {
  // Restrict access to this object.
  let worker: {
    pool: Pool;
    manager: ConcurrencyManager;
  };

  return {
    initializeWorkerPool: (url: string, manager: ConcurrencyManager) => {
      if (worker?.pool) return;

      const pool = workerpool.pool(url, {
        maxWorkers: manager.total,
        minWorkers: manager.total, // Keep all workers alive to preserve WASM cache
        workerOpts: {
          type: import.meta.env.PROD ? undefined : "module",
        },
      });

      worker = {
        pool,
        manager,
      };
    },
    worker: () => {
      return {
        pool: worker.pool,
        manager: worker.manager,
      };
    },
  };
})();

export { initializeWorkerPool };

export const canWorkerProcessImmediately = () => {
  return worker().manager.canIncrement();
};

export type { ExecOptions } from "workerpool/types/types";

type GetTaskName<Task> =
  Task extends Record<string, unknown> ? keyof Task : string;

type AnyFunction = (...args: any) => any;

export type WorkerTask<T extends Record<string, AnyFunction>> = T & CommonTasks;

export type TaskParams<
  Task extends CommonTasks,
  Name extends keyof Task,
> = Parameters<
  Task[Name] extends AnyFunction ? Task[Name] : (...args: unknown[]) => unknown
>;
type MethodReturnType<
  Task extends CommonTasks,
  Name extends GetTaskName<Task>,
  R = Awaited<ReturnType<Task[Name]>>,
> = R extends infer U ? U : R;

export function queueTask<
  Task extends CommonTasks,
  Name extends GetTaskName<Task>,
>(
  method: Name,
  params?: TaskParams<Task, Name>,
  options?: ExecOptions,
): Promise<MethodReturnType<Task, Name>> {
  return worker().pool.exec(method, params, options);
}
