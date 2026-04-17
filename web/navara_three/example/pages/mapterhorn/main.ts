import ThreeView from "@navara/three";

import { run, type CustomDeclarations } from "./run";

const view = new ThreeView<CustomDeclarations>({
  shadow: true,
});
run(view);
