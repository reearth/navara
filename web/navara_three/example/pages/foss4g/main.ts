import ThreeView, { MB } from "@navaramap/three";

import { run, type CustomDescriptions } from "./run";

// Keep the tile cache modest. A cache large enough to hold every city visited
// during the talk sounds friendly, but nothing is ever evicted — and every
// resident label feature keeps costing engine time each frame, so cutting from
// a city to the globe view leaves thousands of neighbourhood labels the camera
// can no longer see still being processed.
const view = new ThreeView<CustomDescriptions>({
  cacheBytes: 1024 * MB,
  debug: true,
});
run(view);
