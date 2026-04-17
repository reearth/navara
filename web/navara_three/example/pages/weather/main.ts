import ThreeView from "@navara/three";

import { run, type CustomDeclarations } from "./run";

const view = new ThreeView<CustomDeclarations>({
  animation: true,
  shadow: true,
  waterTexture: { enabled: true },
});
run(view);
