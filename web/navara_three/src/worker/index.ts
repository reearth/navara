import { registerTasks } from "@navara/worker";

import { computeVertexNormals } from "./tasks/computeVertexNormals";
import { toCreasedNormals } from "./tasks/toCreasedNormals";

const tasks = {
  toCreasedNormals,
  computeVertexNormals,
};

export type Tasks = typeof tasks;

registerTasks(tasks);
