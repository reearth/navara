import ThreeView, { Color } from "@navara/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";
import { TileJsonPlugin } from "@navara/three_plugins";

import { addButton } from "../../../../helpers/button";

import { features } from "./data";

const view = new ThreeView<DefaultDescriptions>();

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);
const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

await view.init();

// Fixed noon sun + ambient fill so the extruded polygon gets shading.
view.atmosphere.date = new Date("2026-07-16T03:00:00Z");
view.addLight({ ambient: { intensity: 0.6 } });
view.addLight({ sun: { intensity: 1.8 } });

view.setCamera({
  lng: 137.6501,
  lat: 36.2357,
  height: 1150,
  heading: 0,
  pitch: -50,
  roll: 0,
});

const basemap = await tilejson.addSource({
  type: "raster-tile",
  url: "https://papers.reearth.land/styles/grayscale/tilejson.json",
});
view.addLayer({ type: "raster", source: basemap });

// One GeoJSON = one source, rendered by the single vector layer below.
const source = view.addSource({ type: "geojson", data: features });

const addLayer = (color: string) => {
  const layer = view.addLayer({
    type: "vector",
    source,
    point: {
      color: new Color().setStyle(color),
      size: 30,
      clampToGround: true,
    },
    polyline: {
      color: new Color().setStyle(color),
      width: 3,
      height: 1,
      clampToGround: false,
    },
    polygon: { color: new Color().setStyle(color), clampToGround: false },
  });
  // Extrude each polygon by its `extrudedHeight` feature property.
  layer.on("featureUpdated", ({ evaluator }) => {
    evaluator.evaluate(
      ({ properties }) => ({
        extrudedHeight: (properties?.["extrudedHeight"] as number) ?? 0,
      }),
      { filters: ["extrudedHeight"] },
    );
  });
  return layer;
};

let color = "#0091ff";
let layer: ReturnType<typeof addLayer> | undefined = addLayer(color);

const toggleButton = addButton("Remove layer");
const styleButton = addButton("Switch color");

toggleButton.onclick = () => {
  if (layer) {
    layer.delete();
    view.forceUpdate(); // repaint the on-demand scene
    layer = undefined;
  } else {
    layer = addLayer(color);
  }
  toggleButton.textContent = layer ? "Remove layer" : "Add layer";
  styleButton.disabled = !layer;
};

styleButton.onclick = () => {
  color = color === "#0091ff" ? "#ff6b2c" : "#0091ff";
  layer?.update({
    point: { color: new Color().setStyle(color) },
    polyline: { color: new Color().setStyle(color) },
    polygon: { color: new Color().setStyle(color) },
  });
};
