import ThreeView, {
  Color,
  degreeToRadian,
  radianToDegree,
  vector3ToGeodetic,
} from "@navaramap/three";
import type { SphereMeshDesc } from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import { initializeExample } from "../../../../helpers/initialize";

const MARKER_RADIUS = 160;
const MARKER_COLOR = new Color().setStyle("#0091ff");

const view = new ThreeView<DefaultDescriptions>();

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);
const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

await view.init();

view.atmosphere.date = new Date("2026-07-16T10:00:00Z");
view.addLight({ ambient: { intensity: 1 } });
view.addLight({ sun: { intensity: 3, applyColor: true } });

view.setCamera({
  lng: 7.6586,
  lat: 45.9763,
  height: 3900,
  distance: 5000,
  heading: 215,
  pitch: -22,
  roll: 0,
});

const terrain = view.addSource({
  type: "quantized-mesh",
  url: "https://terrain.reearth.land/cesium-mesh/ellipsoid/{z}/{x}/{y}.terrain",
  maxZoom: 18,
  requestVertexNormals: true,
});
view.addLayer({ type: "terrain", source: terrain });

const basemap = await tilejson.addSource({
  type: "raster-tile",
  url: "https://papers.reearth.land/styles/papers-dark/tilejson.json",
});
view.addLayer({ type: "raster", source: basemap });

const placeMarker = async (lat: number, lng: number, initialHeight = 0) => {
  const marker = view.addMesh<SphereMeshDesc>({
    sphere: {
      radius: MARKER_RADIUS,
      color: MARKER_COLOR,
    },
    geodetic: {
      lng: radianToDegree(lng),
      lat: radianToDegree(lat),
      height: initialHeight,
    },
  });
  view.forceUpdate();

  // Apply the most detailed terrain height after rendering the sphere.
  const [ground] = await view.sampleTerrainMostDetailed(terrain, [
    { lat, lng },
  ]);
  if (ground.height === undefined) return;
  marker.update({ geodetic: { height: ground.height } });
  view.forceUpdate();
};

let downX = 0;
let downY = 0;
window.addEventListener("mousedown", (event) => {
  downX = event.clientX;
  downY = event.clientY;
});

window.addEventListener("click", (event) => {
  if (Math.hypot(event.clientX - downX, event.clientY - downY) > 4) return;
  const picked = view.pickTerrainPosition(event.clientX, event.clientY);
  if (!picked) return;
  const { lat, lng, height } = vector3ToGeodetic(picked);
  placeMarker(lat, lng, height);
});

placeMarker(degreeToRadian(45.9763), degreeToRadian(7.6586));
placeMarker(degreeToRadian(45.9837), degreeToRadian(7.6706));

view.attribution?.add([
  {
    attribution: "© Re:Earth Terrain",
    attributionUrl: "https://terrain.reearth.land/",
  },
]);

initializeExample(view);
