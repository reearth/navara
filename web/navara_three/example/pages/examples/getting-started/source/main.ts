import ThreeView from "@navaramap/three";
import { DefaultPlugin } from "@navaramap/three_default_plugin";

import { addButton } from "../../../../helpers/button";

// NASA "Blue Marble" (day) and "Black Marble" (night) global imagery.
const DAY_URL =
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg";
const NIGHT_URL = "https://papers.reearth.land/blackmarble/{z}/{x}/{y}.webp";

const view = new ThreeView();

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);

await view.init();

// One source feeds the layer below. The layer never changes; swapping the
// source's data is enough to reload everything that references it.
const imagery = view.addSource({
  type: "raster-tile",
  url: NIGHT_URL,
  maxZoom: 8,
});
view.addLayer({ type: "raster", source: imagery });

view.attribution?.add([
  {
    attribution: "NASA EOSDIS GIBS (Blue Marble)",
    attributionUrl: "https://earthdata.nasa.gov/gibs",
  },
  {
    attribution: "NASA Earth Observatory (Black Marble 2016)",
    attributionUrl:
      "https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps",
  },
  {
    attribution: "Re:Earth Papers",
    attributionUrl: "https://papers.reearth.land",
  },
]);

let night = true;
const button = addButton("Switch to day");
button.onclick = () => {
  night = !night;
  // Source updates are partial: `type` is always required, omitted fields keep
  // their current value.
  imagery.update({ type: "raster-tile", url: night ? NIGHT_URL : DAY_URL });
  button.textContent = night ? "Switch to day" : "Switch to night";
};
