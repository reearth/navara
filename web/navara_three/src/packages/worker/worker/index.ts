import workerpool from "workerpool";

import { commonTasks } from "../tasks";

export { type commonTasks } from "../tasks";

export * from "./transfer";

let isInitialized = false;
export const registerTasks = (
  ...args: Parameters<typeof workerpool.worker>
) => {
  if (!isInitialized) {
    workerpool.worker(commonTasks);
    isInitialized = true;
  }
  return workerpool.worker(...args);
};
