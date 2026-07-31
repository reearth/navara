import ThreeView from "@navaramap/three";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import { addButton } from "../../../../helpers/button";
import { initializeExample } from "../../../../helpers/initialize";

const CAMERA_DISTANCE = 3700;
const AIRPORTS = [
  { label: "Haneda", lng: 139.7798, lat: 35.5494 },
  { label: "Paris CDG", lng: 2.5479, lat: 49.0097 },
  { label: "San Francisco", lng: -122.379, lat: 37.6213 },
  { label: "Dubai", lng: 55.3644, lat: 25.2532 },
];

const view = new ThreeView();

const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

await view.init();

const basemap = await tilejson.addSource({
  type: "raster-tile",
  url: "https://papers.reearth.land/styles/papers-dark/tilejson.json",
});
view.addLayer({ type: "raster", source: basemap });

const [haneda] = AIRPORTS;
view.setCamera({
  lng: haneda.lng,
  lat: haneda.lat,
  distance: CAMERA_DISTANCE,
  heading: 0,
  pitch: -60,
  roll: 0,
});

for (const { label, lng, lat } of AIRPORTS) {
  addButton(label, () => {
    view.flyTo(
      { lng, lat, distance: CAMERA_DISTANCE, heading: 0, pitch: -60, roll: 0 },
      2000,
    );
  });
}

initializeExample(view);
