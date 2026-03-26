import ThreeView, { Color, JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import {
  DefaultPlugin,
  type DefaultLayerDescriptions,
} from "@navara/three_default_plugin";
import type { FeatureCollection } from "geojson";

import { showAttributions } from "../../../helpers/attributions";
import { TERRAIN_DATASETS, TILE_DATASETS } from "../../../helpers/constants";

const tokyoToYokohamaLine: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [139.767, 35.681],
          [139.74, 35.66],
          [139.72, 35.63],
          [139.69, 35.59],
          [139.67, 35.55],
          [139.64, 35.51],
          [139.63, 35.47],
        ],
      },
    },
  ],
};

const run = async () => {
  const view = new ThreeView<DefaultLayerDescriptions>({
    debug: true,
    shadow: true,
  });
  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);
  await view.init();

  const defaultAtmospheres = defaultPlugin.addDefaultPhotorealLayers();
  defaultAtmospheres.sun.update({
    sun: { intensity: 1, castShadow: true },
  });
  view.atmosphere.date.setHours(8);

  view.setCamera({
    lng: 139.7,
    lat: 35.5,
    height: 30000,
    heading: 0,
    pitch: -45,
    roll: 0,
  });

  // Effect Layer
  const bloomEffect = view.addLayer({
    type: "effect",
    selectiveBloom: true,
    selectiveEffectOcclusion: "normal",
    bloomStrength: 1.0,
    bloomRadius: 0.5,
    bloomThreshold: 0.0,
  });

  // Polyline from Tokyo to Yokohama with bloom
  view.addLayer({
    type: "geojson",
    data: tokyoToYokohamaLine,
    polyline: {
      effectIds: [bloomEffect.id],
      emissiveColor: new Color().setHex(0x00ffff),
      emissiveIntensity: 0.8,
      color: new Color().setHex(0x00ffff),
      width: 5,
      maxWidth: 10000,
      height: 500,
    },
  });

  // Base layers
  view.addLayer({
    type: "terrain",
    data: { url: TERRAIN_DATASETS.gsi.url },
    rasterTerrain: {
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
      maxZoom: 15,
    },
  });
  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: { maxZoom: 19 },
  });

  showAttributions([TERRAIN_DATASETS.gsi, TILE_DATASETS.openstreetmap]);
};

run();
