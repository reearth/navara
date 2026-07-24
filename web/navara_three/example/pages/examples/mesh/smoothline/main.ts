import ThreeView from "@navaramap/three";
import type { SmoothLineMeshDesc } from "@navaramap/three_default_descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three_default_plugin";
import { TileJsonPlugin } from "@navaramap/three_plugins";

import { addButton } from "../../../../helpers/button";

import { CENTER, MID_HEIGHT, loopTrajectory } from "./data";

const view = new ThreeView<DefaultDescriptions>();

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);
const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

await view.init();

// Render every frame so the trail can extend itself over time.
view.animation = true;

view.setCamera({
  lng: CENTER.lng,
  lat: CENTER.lat,
  height: MID_HEIGHT,
  distance: 3300,
  heading: 14,
  pitch: -22,
  roll: 0,
});

const basemap = await tilejson.addSource({
  type: "raster-tile",
  url: "https://papers.reearth.land/styles/grayscale/tilejson.json",
});
view.addLayer({ type: "raster", source: basemap });

const trail = view.addMesh<SmoothLineMeshDesc>({
  smoothLines: {
    points: loopTrajectory.slice(0, 2),
    tension: 0.5,
    segments: 24,
    lineWidth: 10,
    color: 0x0091ff,
    dashed: false,
    showPoints: false,
  },
});

const REVEAL_SPEED = 0.3; // control points revealed per frame

let revealed = 2;
let rafId = 0;

const drawUpTo = (count: number) =>
  trail.update({ smoothLines: { points: loopTrajectory.slice(0, count) } });

const step = () => {
  const shown = Math.floor(revealed);
  revealed = Math.min(revealed + REVEAL_SPEED, loopTrajectory.length);
  if (Math.floor(revealed) !== shown) drawUpTo(Math.floor(revealed));
  if (revealed < loopTrajectory.length) rafId = requestAnimationFrame(step);
};

const replay = () => {
  cancelAnimationFrame(rafId);
  revealed = 2;
  drawUpTo(2);
  rafId = requestAnimationFrame(step);
};

addButton("Replay").onclick = replay;
step();
