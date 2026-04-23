import ThreeView from "@navara/three";

import { run, type CustomDescriptions } from "./run";

const view = new ThreeView<CustomDescriptions>({
  animation: true,
  shadow: true,
});
run(view);
