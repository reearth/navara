import ThreeView from "@navara/three";

import { type CustomDescriptions } from "./run";
import { run } from "./run";

const view = new ThreeView<CustomDescriptions>({
  debug: true,
  shadow: true,
  animation: true,
  waterTexture: { enabled: true },
});
run(view);
