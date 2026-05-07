import ThreeView from "@navara/three";
import type { DefaultDescriptions } from "@navara/three_default_plugin";

import { run } from "./run";

const view = new ThreeView<DefaultDescriptions>({
  debug: true,
  shadow: true,
});
run(view);
