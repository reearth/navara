import ThreeView from "@navara/three";
import type { DefaultLayerDescriptions } from "@navara/three_default_plugin";

import { run } from "./run";

const view = new ThreeView<DefaultLayerDescriptions>({
  debug: true,
});
run(view);
