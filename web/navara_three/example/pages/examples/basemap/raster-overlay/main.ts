import ThreeView from "@navaramap/three";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import { addButton } from "../../../../helpers/button";
import { initializeExample } from "../../../../helpers/initialize";

const view = new ThreeView();

const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

await view.init();

view.setCamera({
  lng: -70,
  lat: 15,
  height: 8_000_000,
  heading: 0,
  pitch: -90,
  roll: 0,
});

const basemap = await tilejson.addSource({
  type: "raster-tile",
  url: "https://papers.reearth.land/bluemarble/tilejson.json",
});
view.addLayer({ type: "raster", source: basemap });

const clouds = view.addSource({
  type: "raster-tile",
  url: "https://assets.cms.reearth.io/assets/11/ea0a6a-a94f-47e0-a163-4c675261a1f6/blue-marble-clouds/{z}/{x}/{y}.webp",
  maxZoom: 6,
});
const overlay = view.addLayer({
  type: "raster",
  source: clouds,
});

let shown = true;
const button = addButton("Hide clouds");
button.onclick = () => {
  shown = !shown;
  overlay.update({ raster: { show: shown } });
  button.textContent = shown ? "Hide clouds" : "Show clouds";
};

view.attribution?.add([
  { attribution: "NASA Blue Marble Clouds(Converted as raster tiles)" },
]);

initializeExample(view);
