import ThreeView from "@navaramap/three";
import type { GLTFModelDesc } from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";
import { Pane } from "tweakpane";

import { TERRAIN_DATASETS } from "../../helpers/constants";

const SITE = { lng: 138.036142, lat: 36.085621 };

const view = new ThreeView<DefaultDescriptions>();

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);
const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

await view.init();

view.atmosphere.date = new Date("2026-07-16T03:00:00Z");
view.addLight({ ambient: { intensity: 1.2 } });
view.addLight({ sun: { intensity: 2 } });

view.setCamera({
  lng: SITE.lng,
  lat: SITE.lat,
  // SITE sits in real mountainous terrain (~910m above the ellipsoid, per
  // the quantized-mesh source below) — without matching that, the camera
  // target would be buried underground.
  height: 950,
  distance: 80,
  heading: 0,
  pitch: -40,
  roll: 0,
});

const terrain = view.addSource({
  type: "quantized-mesh",
  url: TERRAIN_DATASETS.reearthQuantizedMesh.url,
  maxZoom: 18,
  requestVertexNormals: true,
});
view.addLayer({ type: "terrain", source: terrain });

const basemap = await tilejson.addSource({
  type: "raster-tile",
  url: "https://papers.reearth.land/styles/black/tilejson.json",
});
view.addLayer({ type: "raster", source: basemap });

view.attribution?.add([TERRAIN_DATASETS.reearthQuantizedMesh]);

// Annotated rather than inferred: tweakpane's `addBinding` mutates these
// fields, and a bare object literal would widen `heightReference` to
// `string`, which `geodetic` will not accept.
const placement: {
  heading: number;
  pitch: number;
  roll: number;
  scale: number;
  height: number;
  heightReference: "ellipsoid" | "terrain";
} = {
  heading: 321,
  pitch: 0,
  roll: 0,
  scale: 1,
  height: 0,
  heightReference: "terrain",
};

const car = view.addMesh<GLTFModelDesc>({
  gltfModel: { url: "/glTF/car/scene.gltf" },
  geodetic: { ...SITE, ...placement },
});

const apply = () => {
  car.update({ geodetic: { ...placement } });
  view.forceUpdate();
};

const pane = new Pane({ title: "geodetic" });
pane
  .addBinding(placement, "heading", { min: 0, max: 360, step: 1 })
  .on("change", apply);
pane
  .addBinding(placement, "pitch", { min: -90, max: 90, step: 1 })
  .on("change", apply);
pane
  .addBinding(placement, "roll", { min: -180, max: 180, step: 1 })
  .on("change", apply);
pane
  .addBinding(placement, "scale", { min: 0.2, max: 5, step: 0.1 })
  .on("change", apply);
pane
  .addBinding(placement, "height", { min: -20, max: 200, step: 1 })
  .on("change", apply);
pane
  .addBinding(placement, "heightReference", {
    options: { ellipsoid: "ellipsoid", terrain: "terrain" },
  })
  .on("change", apply);
