import { MapLibreStylePlugin } from "@navaramap/maplibre-style";
import ThreeView from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { Pane } from "tweakpane";

import {
  MVT_DATASETS,
  TERRAIN_DATASETS,
  TILE_DATASETS,
} from "../../helpers/constants";
import { addCameraControl } from "../../helpers/control";

export type CustomDescriptions = DefaultDescriptions;

/**
 * Simple MapLibre Style example with a polygon layer.
 * This demonstrates the basic functionality of the MapLibreStylePlugin.
 */
export async function run() {
  const view = new ThreeView<CustomDescriptions>({});

  // Add default plugin for camera controls, etc.
  const plugin = new DefaultPlugin();
  view.addPlugin(plugin);

  // Add the MapLibre Style plugin
  const maplibrePlugin = new MapLibreStylePlugin(
    "/example/public/maplibre-style.json",
  );
  view.addPlugin(maplibrePlugin);

  const attribution = view.attribution;

  // Initialize the view
  await view.init();

  // Set up default scene
  plugin.addDefaultPhotorealScene();

  // Position camera to view Tokyo area
  view.setCamera({
    lng: 138.753,
    lat: 35.2,
    height: 15000,
    heading: 0,
    pitch: -45,
    roll: 0,
  });

  // Add controls
  const pane = new Pane();
  addCameraControl(view, pane);

  attribution?.add([
    TILE_DATASETS.openstreetmap,
    TERRAIN_DATASETS.gsi,
    MVT_DATASETS.plateauTokyoFirePrevention,
    MVT_DATASETS.plateauGifuTran,
    MVT_DATASETS.plateauWakayamaGen,
  ]);
}
