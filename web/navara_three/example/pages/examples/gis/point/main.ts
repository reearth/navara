import ThreeView, { Color } from "@navaramap/three";
import { TileJsonPlugin } from "@navaramap/three_plugins";

import { peaks } from "./data";

const view = new ThreeView();

const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

await view.init();

// `distance` frames the peak cluster at the view center.
view.setCamera({
  lng: 170.13,
  lat: -43.575,
  distance: 32_000,
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
    size: 24,
    sizeInMeters: false,
    clampToGround: true,
  },
});
