import ThreeView from "@navaramap/three";

import { run, type CustomDeclarations } from "./run";

const view = new ThreeView<CustomDeclarations>({
  debug: true,
});
run(view);
