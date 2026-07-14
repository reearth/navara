import ThreeView from "@navara/three";

import { run, type CustomDescriptions } from "./run";

const view = new ThreeView<CustomDescriptions>({
  debug: true,
  // Bottom-left so the ⓘ credit trigger clears this page's bottom-right HUD.
  defaultAttribution: { position: "bottom-left" },
});
run(view);
