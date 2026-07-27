import ThreeView, { Color, fetchFontFamilyFromCss } from "@navaramap/three";
import { TileJsonPlugin } from "@navaramap/three_plugins";

import { initializeExample } from "../../../../helpers/initialize";

// The summit of Mount Everest.
const EVEREST = { lng: 86.925, lat: 27.9881 };

const view = new ThreeView();

const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

await view.init();

// Register a Google Font from its stylesheet; glyph files load lazily as
// labels first need them.
view.addFontFamily(
  await fetchFontFamilyFromCss(
    "Arsenal",
    "https://fonts.googleapis.com/css2?family=Arsenal:wght@700",
  ),
);

// `distance` frames the summit at the view center. Close enough that the
// basemap's own summit labels drop out and the text layer stands alone.
view.setCamera({
  lng: EVEREST.lng,
  lat: EVEREST.lat,
  distance: 300,
  heading: 0,
  roll: 0,
});

const basemap = await tilejson.addSource({
  type: "raster-tile",
  url: "https://papers.reearth.land/styles/white/tilejson.json",
});
view.addLayer({ type: "raster", source: basemap });

// A single point labeled with a fixed string — `text` on the material sets
// the same label for every feature in the layer.
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
  text: {
    text: "Mount Everest",
    font: "Arsenal",
    color: new Color().setStyle("#ffffff"),
    size: 110,
    sizeInMeters: false,
    clampToGround: true,
    center: { x: 0.5, y: 0 },
    outlineColor: new Color().setStyle("#000000"),
    outlineWidth: 4,
  },
});

initializeExample(view);
