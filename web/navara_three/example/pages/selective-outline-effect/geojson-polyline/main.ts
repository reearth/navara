import ThreeView, { Color, JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import { DefaultPlugin, type DefaultLayerDescriptions } from "@navara/three_default_plugin";
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
          [139.7671, 35.6812],
          [139.7454, 35.6586],
          [139.7312, 35.6282],
          [139.7101, 35.5943],
          [139.6917, 35.5654],
          [139.6726, 35.5391],
          [139.6503, 35.5101],
          [139.6380, 35.4660],
        ],
      },
    },
  ],
};

const run = async () => {
  const view = new ThreeView<DefaultLayerDescriptions>({ debug: true, shadow: true });
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
  const outlineEffect = view.addLayer({
    type: "effect",
    selectiveOutline: true,
    selectiveEffectOcclusion: "normal",
    outlineColor: new Color().setHex(0x00ff00),
    outlineThickness: 2.0,
    outlineEdgeStrength: 1.0,
  });

  // Polyline from Tokyo to Yokohama with outline
  view.addLayer({
    type: "geojson",
    data: tokyoToYokohamaLine,
    polyline: {
      effectIds: [outlineEffect.id],
      color: new Color().setHex(0xff4444),
      width: 10,
      maxWidth: 10000,
      height: 100,
      clampToGround: false,
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
    data: { url: TILE_DATASETS.gsiSeamlessphoto.url },
    rasterTile: { maxZoom: 18 },
  });

  showAttributions([TERRAIN_DATASETS.gsi, TILE_DATASETS.gsiSeamlessphoto]);
};

run();
