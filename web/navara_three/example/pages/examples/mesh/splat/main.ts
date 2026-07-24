import ThreeView, {
  degreeToRadian,
  geodeticToVector3,
  northUpEastToFixedFrame,
} from "@navaramap/three";
import type { SplatMeshDesc } from "@navaramap/three_default_descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three_default_plugin";
import { TileJsonPlugin } from "@navaramap/three_plugins";

import { initializeExample } from "../../../../helpers/initialize";

const SPLAT_URL = "/splat/Sunny%20Meadow.sog";

const CENTER = { lng: 11.6, lat: 46.543, height: 2 };

const view = new ThreeView<DefaultDescriptions>();

initializeExample(view);

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);
const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

await view.init();

defaultPlugin.addDefaultPhotorealScene();

view.atmosphere.date = new Date("2024-06-21T09:00:00Z");

view.setCamera({
  lng: CENTER.lng,
  lat: CENTER.lat,
  distance: 22,
  heading: 20,
  pitch: -12,
  roll: 0,
});

const basemap = await tilejson.addSource({
  type: "raster-tile",
  url: "https://papers.reearth.land/s2cloudless_2016/tilejson.json",
});
view.addLayer({ type: "raster", source: basemap });

const frame = northUpEastToFixedFrame(
  geodeticToVector3({
    lng: degreeToRadian(CENTER.lng),
    lat: degreeToRadian(CENTER.lat),
    height: CENTER.height,
  }),
);

view.addMesh<SplatMeshDesc>({
  matrixWorld: frame,
  splat: { url: SPLAT_URL, lod: false },
  rotation: { x: Math.PI, y: -Math.PI / 2, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
});

view.attribution?.add([
  {
    attribution: "Sunny Meadow by Jeremias Kieferle - CC BY 4.0",
    attributionUrl: "https://superspl.at/scene/3aacb9d5",
  },
  {
    attributionHtml:
      '<a href="https://s2maps.eu">Sentinel-2 cloudless 2016</a> by <a href="https://eox.at">EOX IT Services GmbH</a> (contains modified Copernicus Sentinel data 2016)',
  },
]);
