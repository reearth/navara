import ThreeView, { Color } from "@navaramap/three";
import { TileJsonPlugin } from "@navaramap/three_plugins";

import { initializeExample } from "../../../../helpers/initialize";

import { peaks } from "./data";

const view = new ThreeView();

const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

await view.init();

// `distance` frames the peak cluster at the view center.
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
  url: "https://papers.reearth.land/styles/white/tilejson.json",
});
view.addLayer({ type: "raster", source: basemap });

// One fixed style for every point — color and size are set on the layer.
const source = view.addSource({ type: "geojson", data: peaks });
view.addLayer({
  type: "vector",
  source,
  point: {
    color: new Color().setStyle("#0091ff"),
    // `sizeInMeters: false` keeps every symbol the same on-screen size
    // regardless of camera distance.
    size: 48,
    sizeInMeters: false,
    clampToGround: true,
  },
});

initializeExample(view);
