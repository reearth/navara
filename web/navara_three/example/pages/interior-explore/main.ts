import ThreeView from "@navara/three";

import { run } from "./run";

const view = new ThreeView({
  shadow: true,
  backgroundColor: 0x475668,
});
run(view);
