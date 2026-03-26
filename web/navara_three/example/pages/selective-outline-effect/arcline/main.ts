import ThreeView, { Color, JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import { DefaultPlugin, type DefaultLayerDescriptions } from "@navara/three_default_plugin";

import { showAttributions } from "../../../helpers/attributions";
import { TERRAIN_DATASETS, TILE_DATASETS } from "../../../helpers/constants";

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
    lat: 35.6,
    height: 50000,
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

  // Arc lines from Tokyo to destinations with outline
  view.addLayer({
    type: "mesh",
    effectIds: [outlineEffect.id],
    arcLines: [
      {
        thickness: 2,
        segments: 64,
        height: 0,
        arcHeightScale: 0.3,
        srcColor: new Color().setHex(0xffffff),
        tgtColor: new Color().setHex(0xff4444),
        geometry: [
          // Tokyo to Osaka
          { lng: 139.7671, lat: 35.6812 },
          { lng: 135.5023, lat: 34.6937 },

          // Tokyo to Nagoya
          { lng: 139.7671, lat: 35.6812 },
          { lng: 136.9066, lat: 35.1815 },

          // Tokyo to Sendai
          { lng: 139.7671, lat: 35.6812 },
          { lng: 140.8720, lat: 38.2604 },
        ],
      },
    ],
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
