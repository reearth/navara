import ThreeView, {
  Color,
  eastNorthUpToFixedFrame,
  geodeticToVector3,
  northEastDownToFixedFrame,
  northUpEastToFixedFrame,
  northWestUpToFixedFrame,
} from "@navaramap/three";
import type { CylinderMeshDesc } from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import { addSwitch } from "../../../../helpers/button";
import { initializeExample } from "../../../../helpers/initialize";

const SITE = { lng: 131.0369, lat: -25.3444 }; // Uluru
const CYLINDER_HEIGHT = 400;

const FRAMES = [
  { label: "ENU", toFixedFrame: eastNorthUpToFixedFrame },
  { label: "NED", toFixedFrame: northEastDownToFixedFrame },
  { label: "NUE", toFixedFrame: northUpEastToFixedFrame },
  { label: "NWU", toFixedFrame: northWestUpToFixedFrame },
];
const DEFAULT_FRAME = 2;

const view = new ThreeView<DefaultDescriptions>();

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);
const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

await view.init();

view.atmosphere.date = new Date("2026-07-16T02:00:00Z");
view.addLight({ ambient: { intensity: 1 } });
view.addLight({ sun: { intensity: 3, applyColor: true } });

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

const [ground] = await view.sampleTerrainMostDetailed(terrain, [
  { lat: SITE.lat, lng: SITE.lng },
]);
const groundHeight = ground.height ?? 0;
const origin = geodeticToVector3({
  lat: SITE.lat,
  lng: SITE.lng,
  height: groundHeight + CYLINDER_HEIGHT / 2,
});

const cylinder = view.addMesh<CylinderMeshDesc>({
  cylinder: {
    radiusTop: 12,
    radiusBottom: 80,
    height: CYLINDER_HEIGHT,
    color: new Color().setStyle("#0091ff"),
  },
  matrixWorld: FRAMES[DEFAULT_FRAME].toFixedFrame(origin),
});

addSwitch(
  FRAMES.map((frame) => frame.label),
  DEFAULT_FRAME,
  (index) => {
    cylinder.update({ matrixWorld: FRAMES[index].toFixedFrame(origin) });
  },
);

view.setCamera({
  lng: SITE.lng,
  lat: SITE.lat,
  height: groundHeight + CYLINDER_HEIGHT / 2,
  distance: 1200,
  heading: 335,
  pitch: -26,
  roll: 0,
});

view.attribution?.add([
  {
    attribution: "© Re:Earth Terrain",
    attributionUrl: "https://terrain.reearth.land/",
  },
]);

initializeExample(view);
