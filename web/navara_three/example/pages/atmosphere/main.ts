import ThreeView from "@navara/three";

import { run } from "./run";

export const ATMOSPHERE_EXAMPLE_OPTIONS = {
  shadow: true,
  mobileOptimization: false,
};

const view = new ThreeView(ATMOSPHERE_EXAMPLE_OPTIONS);
run(view);
