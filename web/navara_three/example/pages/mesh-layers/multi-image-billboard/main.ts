import ThreeView from "@navaramap/three";
import type { DefaultDescriptions } from "@navaramap/three_default_plugin";

import { run } from "./run";

const view = new ThreeView<DefaultDescriptions>({
  debug: true,
});
run(view);
