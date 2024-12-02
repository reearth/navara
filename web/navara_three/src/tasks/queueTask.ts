import {
  queueTask as queueTaskImpl,
  type ExecOptions,
  type TaskParams,
  type WorkerTask,
} from "@navara/worker";

import type { Tasks } from "../worker";

type AllTasks = WorkerTask<Tasks>;
type TaskNames = keyof AllTasks;

export function queueTask<T extends TaskNames>(
  method: T,
  params?: TaskParams<AllTasks, T>,
  options?: ExecOptions,
) {
  return queueTaskImpl(method, params, options);
}
