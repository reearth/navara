import { AmbientLight, AxesHelper, DirectionalLight } from "three";

import ThreeView from "./lib";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
if (!canvas) throw new Error("canvas element not found");

const view = new ThreeView({
  canvas,
  debug: true,
});
await view.init();

const axesHelper = new AxesHelper(5);
axesHelper.scale.multiplyScalar(1e9);
view.scene.add(axesHelper);

const ambientLight = new AmbientLight(0xffffff, 0.2);
view.scene.add(ambientLight);

const directionalLight = new DirectionalLight(0xffffff);
directionalLight.position.set(1, 1, 1);
view.scene.add(directionalLight);

const tileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const terrainUrl = "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png";
const mapboxTerrainUrl = `https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token=${
  import.meta.env.NAVARA_MAPBOX_ACCESS_TOKEN
}`;

// const chiyodaExtent = {
//   west: 139.712,
//   south: 35.6544,
//   north: 35.71,
//   east: 139.782,
// };

// const yokohamaExtent = {
//   west: 139.65357848599274,
//   north: 35.43935502975275,
//   east: 139.66734967157691,
//   south: 35.42795359647897,
// };

// const fujiExtent = {
//   west: 138.558,
//   south: 35.244,
//   north: 35.496,
//   east: 138.866,
// };

// view.addLayer({
//   type: "tiles",
//   color: 0xffffff,
//   segments: 10,
//   height: 0,
//   tile_url: "http://localhost:8888/{z}/{x}/{y}.png",
//   z: 4,
//   max_z: 21,
//   max_sse: 2,
//   wireframe: false,
// });

view.addLayer({
  type: "tiles",
  color: 0xffffff,
  segments: 10,
  tile_url: tileUrl,
  max_sse: 2,
  // FIXME: Currently upsampled terrain is noisy in high zoom level.
  max_z: 23,
  wireframe: false,
});

const terrainType: string = "mapbox"; // mapbox | gsi
const JAPAN_GSI_ELEVATION_DECODER = {
  r_scaler: 65536,
  g_scaler: 256,
  b_scaler: 1,
  offset: 0,
  max_offset: -16777216,
  min_offset: 0,
  boundary: 8388608,
  epsilon: 0.01,
};
const MAPBOX_ELEVATION_DECODER = {
  r_scaler: 65536,
  g_scaler: 256,
  b_scaler: 1,
  offset: -10000,
  max_offset: 0,
  min_offset: 0,
  boundary: 10000,
  epsilon: 0.1,
};

view.addLayer({
  type: "terrain",
  color: 0xffffff,
  segments: 64,
  terrain_url: terrainType === "mapbox" ? mapboxTerrainUrl : terrainUrl,
  max_sse: 2,
  max_z: 15,
  wireframe: false,
  elevation_decoder:
    terrainType === "mapbox" ? MAPBOX_ELEVATION_DECODER : JAPAN_GSI_ELEVATION_DECODER,
});

// chiyoda-ku
// view.addLayer({
//   type: "tiles",
//   color: 0xffffff,
//   segments: 10,
//   height: 36.6,
//   tile_url: tileUrl,
//   z: 12,
//   wireframe: false,
//   extent: chiyodaExtent,
// });

// view.addLayer({
//   type: "3dtiles",
//   url: "https://plateau.geospatial.jp/main/data/3d-tiles/bldg/13100_tokyo/13101_chiyoda-ku/notexture/tileset.json",
// });

// yokohama
// view.addLayer({
//   type: "tiles",
//   tile_url: tileUrl,
//   z: 12,
//   segments: 1,
//   extent: yokohamaExtent,
//   height: 36.5,
//   color: 0xffffff,
//   max_z: 18,
//   wireframe: false,
// });

view.addLayer({
  type: "3dtiles",
  url: "https://assets.cms.plateau.reearth.io/assets/71/f45927-eac8-48d3-9919-414605cf116a/14100_yokohama-shi_2022_3dtiles_2_op_veg/tileset.json",
});

view.addLayer({
  type: "3dtiles",
  url: "https://assets.cms.plateau.reearth.io/assets/6a/d55641-b65d-4c06-a517-56854aae77f7/14100_yokohama-shi_2022_3dtiles_2_op_bldg_14104_naka-ku_lod1/tileset.json",
});

// view.addLayer({
//   type: "mvt",
//   layers: ["Road"],
//   url: "https://assets.cms.plateau.reearth.io/assets/29/cca394-b505-4b92-a3f6-4b90573f2b47/14100_yokohama-shi_city_2023_citygml_1_op_tran_mvt_lod1/{z}/{x}/{y}.mvt",
//   zoom: 13,
//   extent: yokohamaExtent,
//   height: 36.5 + 1,
//   color: 0xffffff,
// });

// fuji
// view.addLayer({
//   type: "tiles",
//   color: 0xffffff,
//   segments: 256,
//   height: 42.0698,
//   tile_url: tileUrl,
//   z: 10,
//   wireframe: false,
//   max_z: 18,
//   extent: fujiExtent,
//   terrain_url: terrainUrl,
// });
