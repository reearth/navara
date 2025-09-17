// GLTF Animation Example - Main Entry Point

import ThreeView from "@navara/three";
import { Pane } from "tweakpane";

import { addHidePaneKeyShortcut } from "../../helpers/control";

import { tileUrls } from "./constants";
import {
  addGeoJsonAnimatedModel,
  addGeoJsonModelControl,
} from "./models/geojson-model";
import {
  addTestModelForNormal,
  addTextModelControl,
} from "./models/gltf-model";

/**
 * Main function to run the GLTF Animation example
 */
export const run = async (view: ThreeView) => {
  await view.init();

  view.animation = true;

  // Add default atmosphere layers
  view.addDefaultAtmosphereLayers();

  // Add base tile layer
  view.addLayer({
    type: "tiles",
    data: { url: tileUrls.openstreetmap },
    raster_tile: {
      max_zoom: 23,
    },
  });

  // Add sample geometry layers
  addSampleGeometry(view);

  // Create control panel
  const pane = new Pane({
    title: "Animation Controls",
    expanded: true,
  });

  addHidePaneKeyShortcut(pane);

  // Create folders for each model
  const gltfFolder = pane.addFolder({
    title: "GLTF Model (Sapporo)",
    expanded: true,
  });

  const geojsonFolder = pane.addFolder({
    title: "GeoJSON Model (Tokyo)",
    expanded: true,
  });

  // Add models and their controls
  const modelLayer = addTestModelForNormal(view);
  const geoJsonModelLayer = addGeoJsonAnimatedModel(view);
  const controls = addTextModelControl(view, gltfFolder, modelLayer);
  addGeoJsonModelControl(view, geojsonFolder, geoJsonModelLayer);

  // Wait for animation initialization, then set initial blend and sync UI
  modelLayer.ref.on("animationReady", () => {
    // Initial blend at this timing becomes the UI initial values
    const initialWeights = [
      { name: "Idle", weight: 0.2 },
      { name: "Walk", weight: 0.5 },
      { name: "Run", weight: 0.3 },
    ] as const;
    // Remember these as the default weights for Reset button
    controls.setDefaultWeights(initialWeights);
    controls.applyWeights(initialWeights);
  });
};

/**
 * Add sample geometry layers for demonstration
 */
function addSampleGeometry(view: ThreeView): void {
  // Add sample line
  view.addLayer({
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: {
        coordinates: [
          [138.64270223212833, 35.42793245331515],
          [138.8398612065625, 35.42635304536398],
          [138.64071756664583, 35.33027587314082],
          [138.8449071750585, 35.32671062382879],
        ],
        type: "LineString",
      },
    },
    polyline: {
      color: 0xff0000,
      width: 2,
    },
  });

  // Add sample polygon
  view.addLayer({
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: {
        coordinates: [
          [
            [138.66861922558115, 35.46838056308519],
            [138.6559918549957, 35.29164005065681],
            [138.81174182884172, 35.279838616806046],
            [138.8071009152797, 35.436389815907134],
            [138.66861922558115, 35.46838056308519],
          ],
        ],
        type: "Polygon",
      },
    },
    polygon: {},
  });
}
