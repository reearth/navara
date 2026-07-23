import ThreeView, { Color } from "@navaramap/three";

const view = new ThreeView();

await view.init();

view.setCamera({
  lng: 20,
  lat: 15,
  height: 16_000_000,
  heading: 0,
  pitch: -90,
  roll: 0,
});

// No basemap: a plain ellipsoid surface gives the clamp-to-ground polygons
// something to drape onto, and the globe base color plays the ocean.
view.addLayer({ type: "terrain", ellipsoid: {} });
view.globe.color = new Color().setStyle("#0b1420");

// World countries as one GeoJSON source; `clampToGround` drapes each polygon
// onto the ellipsoid surface so the shapes curve with the globe.
const source = view.addSource({ type: "geojson", url: "/globe.geojson" });
view.addLayer({
  type: "vector",
  source,
  polygon: {
    color: new Color().setStyle("#0091ff"),
    clampToGround: true,
  },
});

view.attribution?.add([
  {
    attribution: "Made with Natural Earth",
    attributionUrl: "https://www.naturalearthdata.com/",
  },
]);
