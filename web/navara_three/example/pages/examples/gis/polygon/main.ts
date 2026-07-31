import ThreeView, { Color } from "@navaramap/three";

import { initializeExample } from "../../../../helpers/initialize";

const view = new ThreeView();

await view.init();

view.setCamera({
  lng: 20,
  lat: 5,
  height: 6_500_000,
  heading: 0,
  pitch: -90,
  roll: 0,
});

view.addLayer({ type: "terrain", ellipsoid: {} });
view.globe.color = new Color().setStyle("#0b1420");

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

initializeExample(view);
