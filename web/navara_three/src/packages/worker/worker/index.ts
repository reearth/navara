import workerpool from "workerpool";

import { commonTasks } from "../tasks";

export { type commonTasks } from "../tasks";

export * from "./transfer";

workerpool.worker(commonTasks);

export const registerTasks = workerpool.worker;
