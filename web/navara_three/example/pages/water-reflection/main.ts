import ThreeView from "@navara/three";

import { run } from "./run";

const view = new ThreeView({
  debug: true,
  shadow: true,
  animation: true,
  waterTexture: { enabled: true },
});
run(view);
