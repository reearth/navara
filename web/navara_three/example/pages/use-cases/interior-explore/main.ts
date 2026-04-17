import ThreeView, { Color } from "@navara/three";

import { run, type CustomDeclarations } from "./run";

const view = new ThreeView<CustomDeclarations>({
  shadow: true,
  backgroundColor: new Color().setStyle("#475668"),
});
run(view);
