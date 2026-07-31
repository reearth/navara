import ThreeView from "@navaramap/three";

import { addButton } from "../../../../helpers/button";
import { initializeExample } from "../../../../helpers/initialize";

const DAY_URL =
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg";
const NIGHT_URL = "https://papers.reearth.land/blackmarble/{z}/{x}/{y}.webp";

const view = new ThreeView();

await view.init();

view.setCamera({
  lng: 100,
  lat: 25,
  height: 7_500_000,
  heading: 0,
  pitch: -90,
  roll: 0,
});

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
  imagery.update({ type: "raster-tile", url: night ? NIGHT_URL : DAY_URL });
  button.textContent = night ? "Switch to day" : "Switch to night";
};

initializeExample(view);
