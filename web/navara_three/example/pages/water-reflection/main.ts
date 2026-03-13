import ThreeView from "@navara/three";

import { type LayerDescriptions } from "./run";
import { run } from "./run";

const view = new ThreeView<LayerDescriptions>({
  debug: true,
  shadow: true,
  animation: true,
  waterTexture: { enabled: true },
});
run(view);
