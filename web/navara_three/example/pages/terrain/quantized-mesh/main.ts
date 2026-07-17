import ThreeView from "@navaramap/three";

import { run, type CustomDescriptions } from "./run";

const view = new ThreeView<CustomDescriptions>({
  shadow: true,
  debug: true,
});

run(view);
