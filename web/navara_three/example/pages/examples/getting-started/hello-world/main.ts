import ThreeView from "@navara/three";

/**
 * Hello world — the shortest code that puts a map on screen.
 *
 * Create a `ThreeView`, initialize it, register a raster imagery source and
 * render it on the globe. No UI, no plugins — the minimum copy-paste start.
 */
const view = new ThreeView();

await view.init();

// Register a raster imagery source, then render it on the globe.
const imagery = view.addSource({
  type: "raster-tile",
  url: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg",
  maxZoom: 8,
});
view.addLayer({ type: "raster", source: imagery });

view.attribution?.add([
  {
    attributionHtml:
      '<a href="https://papers.reearth.land">Re:Earth Papers</a> · Imagery courtesy of <a href="https://earthdata.nasa.gov/gibs">NASA EOSDIS GIBS</a> · Blue Marble: Next Generation (public domain)',
  },
]);
