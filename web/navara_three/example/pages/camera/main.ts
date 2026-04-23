import ThreeView from "@navara/three";

import { run, type CustomDescriptions } from "./run";

const view = new ThreeView<CustomDescriptions>({
  debug: true,
  mobileOptimization: true,
});
run(view);
