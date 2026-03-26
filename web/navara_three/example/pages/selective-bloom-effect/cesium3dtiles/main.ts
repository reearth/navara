import ThreeView, { Color, JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import {
  DefaultPlugin,
  type DefaultLayerDescriptions,
} from "@navara/three_default_plugin";

import { showAttributions } from "../../../helpers/attributions";
import {
  TERRAIN_DATASETS,
  TILE_DATASETS,
  TILES_3D_DATASETS,
} from "../../../helpers/constants";

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
    lng: 139.7511,
    lat: 35.6736,
    height: 902,
    heading: 64.4,
    pitch: -36,
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

  // Chiyoda buildings with bloom
  view.addLayer({
    type: "cesium3dtiles",
    data: { url: TILES_3D_DATASETS.plateauChiyoda.url },
    model: {
      effectIds: [bloomEffect.id],
      emissiveColor: new Color().setHex(0xffffff),
      emissiveIntensity: 0.3,
      color: new Color().setHex(0xffffff),
      castShadow: true,
      receiveShadow: true,
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

  showAttributions([
    TERRAIN_DATASETS.gsi,
    TILE_DATASETS.gsiSeamlessphoto,
    TILES_3D_DATASETS.plateauChiyoda,
  ]);
};

run();
