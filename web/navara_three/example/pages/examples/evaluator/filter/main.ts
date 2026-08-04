import ThreeView, { Color } from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import { addSlider } from "../../../../helpers/button";
import { initializeExample } from "../../../../helpers/initialize";

const view = new ThreeView<DefaultDescriptions>({
  backgroundColor: new Color().setStyle("#cccccc"),
});

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);
const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

await view.init();

view.atmosphere.date = new Date("2026-08-03T01:00:00Z");

view.setCamera({
  lng: 135.75452,
  lat: 34.98542,
  height: 155.92,
  heading: 31.33,
  pitch: -13.94,
  roll: 0,
});

view.addLight({ ambient: { intensity: 1 } });
view.addLight({ sun: { intensity: 2, applyColor: true } });

const terrain = view.addSource({
  type: "quantized-mesh",
  url: "https://terrain.reearth.land/cesium-mesh/ellipsoid/{z}/{x}/{y}.terrain",
  maxZoom: 18,
  minZoom: 2,
  requestVertexNormals: true,
});
view.addLayer({ type: "terrain", source: terrain });

const basemap = await tilejson.addSource({
  type: "raster-tile",
  url: "https://papers.reearth.land/styles/papers-light/tilejson.json",
});
view.addLayer({ type: "raster", source: basemap });

const buildings = view.addSource({
  type: "3d-tiles",
  url: "https://assets.cms.plateau.reearth.io/assets/1a/742b55-cd5f-460e-991c-f3b03242f2db/26100_kyoto-shi_city_2025_citygml_1_op_bldg_3dtiles_26106_shimogyo-ku_lod2_no_texture/tileset.json",
});
const layer = view.addLayer({
  type: "3d-tiles",
  source: buildings,
  model: {
    color: new Color().setStyle("#ffffff"),
    metalness: 0,
    roughness: 1,
  },
});

let minHeight = 40;

layer.on("featureUpdated", ({ evaluator }) => {
  evaluator.evaluate(
    ({ properties }) => {
      const measuredHeight =
        (properties?.["bldg:measuredHeight"] as number) ?? 0;
      return { show: measuredHeight >= minHeight };
    },
    { filters: ["bldg:measuredHeight"] },
  );
});

addSlider(
  "Min height",
  { min: 0, max: 131, value: minHeight, step: 1, unit: "m" },
  (value) => {
    minHeight = value;
    layer.forceUpdate();
  },
);

view.attribution?.add([
  {
    attribution:
      "3D City Model (Project PLATEAU) Kyoto City (FY2025) - MLIT PLATEAU",
    attributionUrl:
      "https://www.geospatial.jp/ckan/dataset/plateau-26100-kyoto-shi-2025",
  },
  {
    attribution: "Re:Earth Terrain",
    attributionUrl: "https://terrain.reearth.land/",
  },
  {
    attribution: "© Mapterhorn",
    attributionUrl: "https://mapterhorn.com/attribution",
  },
]);

initializeExample(view);
