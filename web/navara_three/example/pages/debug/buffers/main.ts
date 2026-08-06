import ThreeView from "@navaramap/three";

import { run, type CustomDescriptions } from "./run";

const view = new ThreeView<CustomDescriptions>({
  debug: true,
  shadow: true,
});
run(view);
