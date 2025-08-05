import ThreeView from "@navara/three";

import { run } from "./run";

const view = new ThreeView({
  animation: true,
  shadow: true,
});
run(view);
