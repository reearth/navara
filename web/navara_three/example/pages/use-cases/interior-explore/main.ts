import ThreeView, { Color } from "@navara/three";

import { run, type CustomDescriptions } from "./run";

const view = new ThreeView<CustomDescriptions>({
  shadow: true,
  backgroundColor: new Color().setStyle("#475668"),
});
run(view);
