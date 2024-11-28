import workerpool from "workerpool";
import type Pool from "workerpool/types/Pool";
import type { ExecOptions } from "workerpool/types/types";

import { type commonTasks } from "./worker";

let pool: Pool;
export const initializeWorkerPool = (
  url: string,
  concurrency = navigator.hardwareConcurrency - 1,
): Pool =>
  pool ??
  (pool = workerpool.pool(url, {
    maxWorkers: concurrency,
    workerOpts: {
      type: import.meta.env.PROD ? undefined : "module",
    },
  }));

export const workerPool = (): Pool => pool;

export const canWorkerProcessImmediately = () => {
  const stats = workerPool().stats();
  return stats.pendingTasks === 0;
};

export type { ExecOptions } from "workerpool/types/types";

type GetTaskName<Task> = Task extends { [K in string]: unknown }
  ? keyof Task
  : string;

type AnyFunction = (...args: any) => any;

export type WorkerTask<T extends { [K in string]: AnyFunction }> = T &
  CommonTask;

type CommonTask = typeof commonTasks;

export type TaskParams<
  Task extends CommonTask,
  Name extends keyof Task,
> = Parameters<
  Task[Name] extends AnyFunction ? Task[Name] : (...args: unknown[]) => unknown
>;
type MethodReturnType<
  Task extends CommonTask,
  Name extends GetTaskName<Task>,
  R = Awaited<ReturnType<Task[Name]>>,
> = R extends infer U ? U : R;

export async function queueTask<
  Task extends CommonTask,
  Name extends GetTaskName<Task>,
>(
  method: Name,
  params?: TaskParams<Task, Name>,
  options?: ExecOptions,
): Promise<MethodReturnType<Task, Name>> {
  return await workerPool().exec(method, params, options);
}
