import { registerTasks } from "@navara/worker";

import { toCreasedNormals } from "./tasks/toCreasedNormals";

const tasks = {
  toCreasedNormals,
};

export type Tasks = typeof tasks;

registerTasks(tasks);
