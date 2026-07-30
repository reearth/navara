import ThreeView, { Color } from "@navaramap/three";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import { initializeExample } from "../../../../helpers/initialize";

const view = new ThreeView();

const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

await view.init();

view.setCamera({
  lng: 12.334,
  lat: 45.438,
  distance: 3400,
  heading: 35,
  pitch: -35,
  roll: 0,
});

const basemap = await tilejson.addSource({
  type: "raster-tile",
  url: "https://papers.reearth.land/styles/papers-light/tilejson.json",
});
view.addLayer({ type: "raster", source: basemap });

const source = view.addSource({
  type: "geojson",
  url: "/venice_canals.geojson",
});
view.addLayer({
  type: "vector",
  source,
  polyline: {
    color: new Color().setStyle("#0091ff"),
    width: 7,
    height: 1,
    clampToGround: true,
  },
});

view.attribution?.add([
  {
    attribution: "© OpenStreetMap contributors",
    attributionUrl: "https://www.openstreetmap.org/copyright",
  },
]);

initializeExample(view);
