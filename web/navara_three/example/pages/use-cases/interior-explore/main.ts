import ThreeView, { Color } from "@navara/three";

import { run, type LayerDescriptions } from "./run";

const view = new ThreeView<LayerDescriptions>({
  shadow: true,
  backgroundColor: new Color().setStyle("#475668"),
});
run(view);
