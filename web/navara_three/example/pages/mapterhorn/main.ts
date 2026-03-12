import ThreeView from "@navara/three";

import { run, type LayerDescriptions } from "./run";

const view = new ThreeView<LayerDescriptions>({
  shadow: true,
});
run(view);
