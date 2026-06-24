import ThreeView, { JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";
import { MapLibreStylePlugin } from "@navara/maplibre_style";

import { showAttributions } from "../../helpers/attributions";
import { addCameraControl } from "../../helpers/control";
import { TILE_DATASETS, TERRAIN_DATASETS } from "../../helpers/constants";
import { Pane } from "tweakpane";

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

  // Define a simple MapLibre Style with a GeoJSON polygon layer
  const style = {
    version: 8,
    sources: {
      "simple-polygon": {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {
                name: "Polygon A",
                type: "polygon",
                No: 1,
              },
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [138.680022, 35.317328],
                    [138.712022, 35.317328],
                    [138.712022, 35.349328],
                    [138.680022, 35.349328],
                    [138.680022, 35.317328],
                  ],
                ],
              },
            },
            {
              type: "Feature",
              properties: {
                name: "Polygon B",
                type: "polygon",
                No: 2,
              },
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [138.721166, 35.317328],
                    [138.753166, 35.317328],
                    [138.753166, 35.349328],
                    [138.721166, 35.349328],
                    [138.721166, 35.317328],
                  ],
                ],
              },
            },
            {
              type: "Feature",
              properties: {
                name: "Polygon C",
                type: "polygon",
                No: 3,
              },
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [138.76231, 35.317328],
                    [138.79431, 35.317328],
                    [138.79431, 35.349328],
                    [138.76231, 35.349328],
                    [138.76231, 35.317328],
                  ],
                ],
              },
            },
            {
              type: "Feature",
              properties: {
                name: "Polygon D",
                type: "polygon",
                No: 4,
              },
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [138.803455, 35.317328],
                    [138.835455, 35.317328],
                    [138.835455, 35.349328],
                    [138.803455, 35.349328],
                    [138.803455, 35.317328],
                  ],
                ],
              },
            },
          ],
        },
      },
    },
    layers: [
      {
        id: "polygon-fill",
        type: "fill",
        source: "simple-polygon",
        filter: [">", ["get", "No"], 0],
        paint: {
          "fill-color": [
            "case",
            // case: If the "No" property is odd
            [
              "!=",
              [
                "-",
                ["get", "No"],
                ["*", ["floor", ["/", ["get", "No"], 2]], 2],
              ],
              0,
            ],
            "#bf61f6", // odd
            "#0062ff", // even
          ],
        },
      },
    ],
  };

  // Add the MapLibre Style plugin
  const maplibrePlugin = new MapLibreStylePlugin(style);
  view.addPlugin(maplibrePlugin);

  // Initialize the view
  await view.init();

  // Set up default scene
  plugin.addDefaultPhotorealScene();

  // Add base tile layer for context
  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: { maxZoom: 19 },
  });
  view.addLayer({
    type: "terrain",
    data: {
      url: TERRAIN_DATASETS.gsi.url,
    },
    rasterTerrain: {
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
      maxZoom: 15,
      castShadow: true,
      receiveShadow: true,
    },
  });

  view.addLayer({
    type: "tiles",
    data: { url: TERRAIN_DATASETS.gsi.url },
    rasterTile: {
      maxZoom: 15,
    },
    hillshade: {
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    },
  });

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

  showAttributions([TILE_DATASETS.openstreetmap, TERRAIN_DATASETS.gsi]);
}
