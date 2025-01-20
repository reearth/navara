import type { Scene } from "three";

export type Scenes = {
  // Render world that includes user setting object like light
  world: Scene;
  // Render general mesh that doesn't need to handle special case.
  main: Scene;
  // Render only globe.
  globe: Scene;
  // Render only globe for G-Buffer.
  globeGBuffer: Scene;
  // Render only draped features
  drapedFeatures: Scene;
  // for picking
  pick: Scene;
};
