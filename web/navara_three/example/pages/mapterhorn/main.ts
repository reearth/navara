import ThreeView from "@navara/three";
import type { DefaultLayerDescriptions } from "@navara/three_default_plugin";

import { run } from "./run";

const view = new ThreeView<DefaultLayerDescriptions>({
  shadow: true,
});
run(view);
