import ThreeView, { Color } from "@navaramap/three";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import { initializeExample } from "../../../../helpers/initialize";

import { peaks } from "./data";

const view = new ThreeView();

const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

await view.init();

view.setCamera({
  lng: 170.16,
  lat: -43.57,
  distance: 17_000,
  heading: 0,
  pitch: -60,
  roll: 0,
});

const basemap = await tilejson.addSource({
  type: "raster-tile",
  url: "https://papers.reearth.land/styles/papers-light/tilejson.json",
});
view.addLayer({ type: "raster", source: basemap });

const source = view.addSource({ type: "geojson", data: peaks });
view.addLayer({
  type: "vector",
  source,
  point: {
    color: new Color().setStyle("#0091ff"),
    size: 48,
    sizeInMeters: false,
    clampToGround: true,
  },
});

initializeExample(view);
