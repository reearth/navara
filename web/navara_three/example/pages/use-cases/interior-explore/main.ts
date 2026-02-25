import ThreeView, { Color } from "@navara/three";
import type { DefaultLayerDescriptions } from "@navara/three_default_plugin";

import { run } from "./run";

const view = new ThreeView<DefaultLayerDescriptions>({
  shadow: true,
  backgroundColor: new Color().setStyle("#475668"),
});
run(view);
