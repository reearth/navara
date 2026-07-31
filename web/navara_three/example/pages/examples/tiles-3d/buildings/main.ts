import ThreeView, { Color } from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import { initializeExample } from "../../../../helpers/initialize";

const view = new ThreeView<DefaultDescriptions>();

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);
const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

await view.init();

view.atmosphere.date = new Date("2026-07-16T05:00:00Z");
view.addLight({ ambient: { intensity: 0.5 } });
view.addLight({ sun: { intensity: 2, applyColor: true } });

view.setCamera({
  lng: 139.7671,
  lat: 35.6812,
  distance: 1000,
  heading: 50,
  pitch: -35,
  roll: 0,
});

const terrain = view.addSource({
  type: "quantized-mesh",
  url: "https://terrain.reearth.land/cesium-mesh/ellipsoid/{z}/{x}/{y}.terrain",
  maxZoom: 18,
});
view.addLayer({ type: "terrain", source: terrain });

const basemap = await tilejson.addSource({
  type: "raster-tile",
  url: "https://papers.reearth.land/styles/papers-light/tilejson.json",
});
view.addLayer({ type: "raster", source: basemap });

const chiyoda = view.addSource({
  type: "3d-tiles",
  url: "https://assets.cms.plateau.reearth.io/assets/db/070026-aa27-431b-8d53-7cc6b03244f8/13101_chiyoda-ku_pref_2023_citygml_1_op_bldg_3dtiles_13101_chiyoda-ku_lod2_no_texture/tileset.json",
});
view.addLayer({
  type: "3d-tiles",
  source: chiyoda,
  model: { color: new Color().setHex(0xffffff), metalness: 0, roughness: 1 },
});

const chuo = view.addSource({
  type: "3d-tiles",
  url: "https://assets.cms.plateau.reearth.io/assets/4c/f2436a-e2be-40e2-83da-f1781f36e30b/13102_chuo-ku_pref_2023_citygml_1_op_bldg_3dtiles_13102_chuo-ku_lod2_no_texture/tileset.json",
});
view.addLayer({
  type: "3d-tiles",
  source: chuo,
  model: { color: new Color().setHex(0xffffff), metalness: 0, roughness: 1 },
});

view.attribution?.add([
  {
    attribution:
      "3D City Model (Project PLATEAU) Chiyoda Ward (FY2023) - MLIT PLATEAU",
    attributionUrl:
      "https://www.geospatial.jp/ckan/dataset/plateau-13101-chiyoda-ku-2023",
  },
  {
    attribution:
      "3D City Model (Project PLATEAU) Chuo Ward (FY2023) - MLIT PLATEAU",
    attributionUrl:
      "https://www.geospatial.jp/ckan/dataset/plateau-13102-chuo-ku-2023",
  },
  {
    attribution: "© Re:Earth Terrain",
    attributionUrl: "https://terrain.reearth.land/",
  },
]);

initializeExample(view);
