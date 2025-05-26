import ThreeView from "@navara/three";

import { run } from "./run";

const view = new ThreeView({
  debug: true,
  atmosphere: {
    aerialPerspective: true,
  },
});
run(view);
