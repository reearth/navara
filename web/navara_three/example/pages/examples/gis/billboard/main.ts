import ThreeView, { Color } from "@navaramap/three";
import { TileJsonPlugin } from "@navaramap/three_plugins";

// The summit of Mount Everest.
const EVEREST = { lng: 86.925, lat: 27.9881 };

const view = new ThreeView();

const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

await view.init();

// `distance` frames the summit at the view center.
view.setCamera({
  lng: EVEREST.lng,
  lat: EVEREST.lat,
  distance: 7000,
  heading: 0,
  pitch: -55,
  roll: 0,
});

const basemap = await tilejson.addSource({
  type: "raster-tile",
  url: "https://papers.reearth.land/styles/white/tilejson.json",
});
view.addLayer({ type: "raster", source: basemap });

// A billboard renders an image at each point; `center: {x: 0, y: -0.5}`
// anchors the tip of the pin image to the coordinate.
const source = view.addSource({
  type: "geojson",
  data: {
    type: "Feature",
    properties: {},
    geometry: { type: "Point", coordinates: [EVEREST.lng, EVEREST.lat] },
  },
});
view.addLayer({
  type: "vector",
  source,
  billboard: {
    url: "/example.png",
    color: new Color().setStyle("#ffffff"),
    // `sizeInMeters: false` keeps the pin the same on-screen size regardless
    // of camera distance.
    size: 96,
    sizeInMeters: false,
    center: { x: 0, y: -0.5 },
    transparent: true,
    clampToGround: true,
  },
});
