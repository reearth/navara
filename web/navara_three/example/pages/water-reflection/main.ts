import ThreeView from "@navara/three";

import { run } from "./run";

const view = new ThreeView({
  debug: true,
  shadow: true,
});
run(view);
