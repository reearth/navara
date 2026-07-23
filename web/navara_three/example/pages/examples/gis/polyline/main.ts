import ThreeView, { Color } from "@navaramap/three";
import { TileJsonPlugin } from "@navaramap/three_plugins";

const view = new ThreeView();

const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

await view.init();

// Straight-down view over the historic center of Venice.
view.setCamera({
  lng: 12.334,
  lat: 45.438,
  height: 4200,
  heading: 0,
  pitch: -90,
  roll: 0,
});

const basemap = await tilejson.addSource({
  type: "raster-tile",
  url: "https://papers.reearth.land/styles/white/tilejson.json",
});
view.addLayer({ type: "raster", source: basemap });

// Venice's canal network (OpenStreetMap waterways) as one GeoJSON source;
// every line shares the same fixed color and width.
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
