import ThreeView, { Color } from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";

import { initializeExample } from "../../../../helpers/initialize";

const view = new ThreeView<DefaultDescriptions>({ animation: true });

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);

await view.init();

const scene = defaultPlugin.addDefaultPhotorealScene();
view.toneMappingExposure = 40;

view.addLight({
  ambient: { intensity: 0.01, color: new Color().setStyle("#d0c9b7") },
});

view.setCamera({
  lng: 124.26761,
  lat: 24.426724,
  height: 50,
  heading: 258.9,
  pitch: 10,
  roll: 0,
});
view.camera.fov = 40;

const terrain = view.addSource({
  type: "quantized-mesh",
  url: "https://terrain.reearth.land/cesium-mesh/ellipsoid/{z}/{x}/{y}.terrain",
  maxZoom: 18,
  requestVertexNormals: true,
  requestWaterMask: true,
});
view.addLayer({ type: "terrain", source: terrain });

const satellite = view.addSource({
  type: "raster-tile",
  url:
    "https://tiles.maps.eox.at/wmts?layer=s2cloudless-2020_3857&style=default" +
    "&tilematrixset=g&Service=WMTS&Request=GetTile" +
    "&Version=1.0.0&Format=image%2Fjpeg" +
    "&TileMatrix={z}&TileCol={x}&TileRow={y}",
  maxZoom: 15,
});
view.addLayer({ type: "raster", source: satellite });

view.atmosphere.date = new Date("2025-08-24T01:40:00+09:00");
scene.stars.update({ stars: { intensity: 100, pointSize: 1.1 } });

view.attribution?.add([
  {
    attribution: "© Re:Earth Terrain",
    attributionUrl: "https://terrain.reearth.land/",
  },
  {
    attributionHtml:
      '<a href="https://s2maps.eu">Sentinel-2 cloudless 2020</a> by <a href="https://eox.at">EOX IT Services GmbH</a> (contains modified Copernicus Sentinel data 2020)',
  },
]);

initializeExample(view);
