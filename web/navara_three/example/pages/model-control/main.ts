import ThreeView from "@navara/three";

import { run } from "./run";

const view = new ThreeView({
  shadow: true,
  debug: true,
});
run(view);
