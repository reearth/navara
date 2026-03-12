import ThreeView from "@navara/three";

import { run, type LayerDescriptions } from "./run";

const view = new ThreeView<LayerDescriptions>({
  shadow: true,
  debug: true,
});
run(view);
