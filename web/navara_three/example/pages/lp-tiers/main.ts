import ThreeView, { Color } from "@navaramap/three";

import { initializeExample } from "../../helpers/initialize";

import { run, scene, type CustomDescriptions } from "./run";

const view = new ThreeView<CustomDescriptions>({
  shadow: true,
  // The plain scenes (1 and 3) have no atmosphere; a light gray backdrop
  // stands in for the sky.
  backgroundColor:
    scene === 1 || scene === 3 ? new Color().setStyle("#4e545c") : undefined,
});
// Post the scene-loaded signal once tiles settle, so the screenshot tooling
// can wait for it. NB: capture the stills with a REAL GPU (Playwright
// `headless: false`) — headless SwiftShader renders SSAO / SMAA / FogLight
// differently from the live device (buildings come out semi-transparent and
// the terrain detail is under-rendered). See references/scene-tiers.md.
run(view).then(() => initializeExample(view));
