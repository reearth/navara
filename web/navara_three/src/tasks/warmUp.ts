import type { Promise } from "@navara/worker";

import { queueTask } from "./queueTask";

export function warmUp(): Promise<void> {
  return queueTask("warmUp");
}
