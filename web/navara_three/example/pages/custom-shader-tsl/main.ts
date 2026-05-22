import ThreeView from "@navara/three";

import { run, type CustomDescriptions } from "./run";

const view = new ThreeView<CustomDescriptions>({
  picking: true,
  shadow: true,
  animation: true,
});
run(view);
