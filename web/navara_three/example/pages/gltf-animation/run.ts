// GLTF Animation Example - Main Entry Point

import ThreeView from "@navara/three";
import { Pane } from "tweakpane";

import { TILE_URLS } from "../../helpers/constants";
import { addHidePaneKeyShortcut } from "../../helpers/control";

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
    data: { url: TILE_URLS.openstreetmap },
    raster_tile: {
      max_zoom: 23,
    },
  });

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
