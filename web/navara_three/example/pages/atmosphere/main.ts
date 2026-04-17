import ThreeView from "@navara/three";

import { run } from "./run";
import { type CustomDeclarations } from "./run";

export const ATMOSPHERE_EXAMPLE_OPTIONS = {
  shadow: true,
  mobileOptimization: false,
};

const view = new ThreeView<CustomDeclarations>(ATMOSPHERE_EXAMPLE_OPTIONS);
run(view);
