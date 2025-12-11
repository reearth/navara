import ThreeView, { Color } from "@navara/three";

import { run } from "./run";

const view = new ThreeView({
  shadow: true,
  backgroundColor: new Color().setStyle("#475668"),
});
run(view);
