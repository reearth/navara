import ThreeView, { MB } from "@navara/three";

import { run, type CustomDescriptions } from "./run";

const view = new ThreeView<CustomDescriptions>({
  debug: true,
  cacheBytes: 4096 * MB,
});
run(view);
