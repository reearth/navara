import ThreeView, { Color } from "@navaramap/three";
import type { ArclineMeshDesc } from "@navaramap/three_default_descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three_default_plugin";
import { TileJsonPlugin } from "@navaramap/three_plugins";

import { addButton } from "../../../../helpers/button";
import { initializeExample } from "../../../../helpers/initialize";

import { flightArcs } from "./data";

const view = new ThreeView<DefaultDescriptions>();

initializeExample(view);

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);
const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

await view.init();

// Render every frame for the dash animation.
view.animation = true;

view.setCamera({
  lng: 146,
  lat: 33,
  height: 7_600_000,
  heading: 0,
  pitch: -73,
  roll: 0,
});

const basemap = await tilejson.addSource({
  type: "raster-tile",
  url: "https://papers.reearth.land/blackmarble/tilejson.json",
});
view.addLayer({ type: "raster", source: basemap });

// `gradation` (0→1) sweeps a bright band from srcColor to tgtColor.
const arcs = view.addMesh<ArclineMeshDesc>({
  arcLines: {
    geometry: flightArcs,
    srcColor: new Color().setStyle("#cfcfcf"),
    tgtColor: new Color().setStyle("#0091ff"),
    thickness: 1.2,
    segments: 96,
    arcHeightScale: 0.35,
    gradation: 0.3,
    dashed: false,
    dashSize: 1500_000,
    gapSize: 500_000,
  },
});

let dashed = false;
const dashButton = addButton("Dashed: off");
dashButton.onclick = () => {
  dashed = !dashed;
  arcs.update({ arcLines: { dashed } });
  dashButton.textContent = dashed ? "Dashed: on" : "Dashed: off";
};

let gradation = 0;
const animate = () => {
  gradation = gradation - 5000;
  arcs.update({ arcLines: { dashOffset: gradation } });
  requestAnimationFrame(animate);
};
animate();
