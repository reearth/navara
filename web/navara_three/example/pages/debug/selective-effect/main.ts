import ThreeView from "@navaramap/three";
import type { DefaultDescriptions } from "@navaramap/three-default-plugin";

import { run } from "./run";

const view = new ThreeView<DefaultDescriptions>({
  debug: true,
  shadow: true,
});
run(view);
