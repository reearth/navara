import ThreeView from "@navara/three";

import { type CustomDeclarations } from "./run";
import { run } from "./run";

const view = new ThreeView<CustomDeclarations>({
  debug: true,
  shadow: true,
  animation: true,
  waterTexture: { enabled: true },
});
run(view);
