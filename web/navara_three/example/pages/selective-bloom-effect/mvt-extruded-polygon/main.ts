import ThreeView, { Color, JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import { DefaultPlugin, type DefaultLayerDescriptions } from "@navara/three_default_plugin";

import { showAttributions } from "../../../helpers/attributions";
import {
  MVT_DATASETS,
  TERRAIN_DATASETS,
  TILE_DATASETS,
} from "../../../helpers/constants";

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
    lng: 139.767,
    lat: 35.681,
    height: 1000,
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

  // MVT extruded polygon layer with bloom
  view.addLayer({
    type: "mvt",
    data: { url: MVT_DATASETS.plateauTokyoHeightControl.url },
    polygon: {
      effectIds: [bloomEffect.id],
      emissiveColor: new Color().setHex(0x44ff44),
      emissiveIntensity: 0.5,
      color: new Color().setHex(0x44ff44),
      height: 0,
      extrudedHeight: 50,
      castShadow: true,
      receiveShadow: true,
    },
    vectorTile: { maxZoom: 16 },
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
    MVT_DATASETS.plateauTokyoHeightControl,
  ]);
};

run();
