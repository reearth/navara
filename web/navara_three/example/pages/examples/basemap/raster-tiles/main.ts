import ThreeView from "@navaramap/three";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import { initializeExample } from "../../../../helpers/initialize";

const view = new ThreeView();

const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

await view.init();

view.setCamera({
  lng: 20,
  lat: 10,
  height: 8_000_000,
  heading: 0,
  pitch: -90,
  roll: 0,
});

const raster = view.addSource({
  type: "raster-tile",
  url: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg",
  maxZoom: 8,
});

view.addLayer({
  type: "raster",
  source: raster,
});

view.attribution?.add([
  {
    attributionHtml: `Imagery courtesy of <a href="https://earthdata.nasa.gov/gibs">NASA EOSDIS GIBS</a> · Blue Marble: Next Generation (public domain)`,
  },
]);

initializeExample(view);
