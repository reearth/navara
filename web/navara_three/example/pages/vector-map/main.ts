import ThreeView from "@navara/three";

import { run } from "./run";

const view = new ThreeView({
  debug: true,
  antialias: {
    enabled: true,
  },
});
run(view);
