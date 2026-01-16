import workerpool, { Promise } from "workerpool";
import type Pool from "workerpool/types/Pool";
import type { ExecOptions } from "workerpool/types/types";

import { type CommonTasks } from "./worker";

export type { Promise } from "workerpool";

const DEFAULT_CONCURRENCY = navigator.hardwareConcurrency - 1;

let pool: Pool;
export const initializeWorkerPool = (
  url: string,
  concurrency = DEFAULT_CONCURRENCY,
): Pool =>
  pool ??
  (pool = workerpool.pool(url, {
    maxWorkers: concurrency,
    minWorkers: concurrency, // Keep all workers alive to preserve WASM cache
    workerOpts: {
      type: import.meta.env.PROD ? undefined : "module",
    },
  }));

export const workerPool = (): Pool => pool;

export const canWorkerProcessImmediately = () => {
  const stats = workerPool().stats();
  return stats.busyWorkers < (workerPool().maxWorkers ?? DEFAULT_CONCURRENCY);
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
  return workerPool().exec(method, params, options);
}
