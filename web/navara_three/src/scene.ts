import type { Scene } from "three";

export type Scenes = {
  main: Scene;
  // Render only globe
  globe: Scene;
  // Render only draped features
  drapedFeatures: Scene;
  // for picking
  pick: Scene;
};
