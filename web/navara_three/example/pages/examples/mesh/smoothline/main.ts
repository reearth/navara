import ThreeView from "@navaramap/three";
import type { SmoothLineMeshDesc } from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import { addButton } from "../../../../helpers/button";
import { initializeExample } from "../../../../helpers/initialize";

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
  distance: 2300,
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

const REVEAL_SPEED = 36; // control points revealed per second

let revealed = 2;
let rafId = 0;
let prevTime: number | undefined;

const drawUpTo = (count: number) =>
  trail.update({ smoothLines: { points: loopTrajectory.slice(0, count) } });

// Advance by elapsed wall-clock time (capped across tab suspensions), so the
// reveal speed is the same on every display refresh rate.
const step = (time: number) => {
  const elapsed =
    prevTime === undefined ? 0 : Math.min(time - prevTime, 100) / 1000;
  prevTime = time;
  const shown = Math.floor(revealed);
  revealed = Math.min(revealed + REVEAL_SPEED * elapsed, loopTrajectory.length);
  if (Math.floor(revealed) !== shown) drawUpTo(Math.floor(revealed));
  if (revealed < loopTrajectory.length) rafId = requestAnimationFrame(step);
};

const replay = () => {
  cancelAnimationFrame(rafId);
  revealed = 2;
  prevTime = undefined;
  drawUpTo(2);
  rafId = requestAnimationFrame(step);
};

addButton("Replay").onclick = replay;
rafId = requestAnimationFrame(step);

initializeExample(view);
