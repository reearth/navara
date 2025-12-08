import ThreeView, { JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";

import { showAttributions } from "../../helpers/attributions";
import {
  TERRAIN_DATASETS,
  TILE_DATASETS,
  TILES_3D_DATASETS,
} from "../../helpers/constants";

export const run = async (view: ThreeView) => {
  await view.init();

  view.atmosphere.date.setHours(8);
  view.toneMappingExposure = 10;

  view.addDefaultEffectLayers();
  const defaultLayers = view.addDefaultAtmosphereLayers();

  const sunLightLayer = defaultLayers.sun;
  sunLightLayer.update({
    sun: {
      castShadow: true,
    },
  });

  view.addLayer({
    type: "terrain",
    data: {
      url: TERRAIN_DATASETS.gsi.url,
    },
    rasterTerrain: {
      maxZoom: 15,
      minZoom: 6,
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
      castShadow: true,
      receiveShadow: true,
    },
  });

  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.gsiSeamlessphoto.url },
    rasterTile: {
      color: 0xffffff,
      maxZoom: 18,
    },
  });

  view.addLayer({
    type: "cesium3dtiles",
    data: {
      url: TILES_3D_DATASETS.plateauToranomonHillsBIM.url,
      // url: TILES_3D_DATASETS.plateauTakanawa.url,
    },
    model: {
      show: true,
      castShadow: true,
      receiveShadow: true,
      height: -35,
    },
  });

  // Toranomon Hills
  view.setCamera({
    lng: 139.7460838759,
    lat: 35.6625239152,
    height: 295.6,
    heading: 21.5815985024,
    pitch: -19,
    roll: 0,
  });

  // Takanawa
  // view.setCamera({
  //   lng: 139.7597808838,
  //   lat: 35.6186485291,
  //   height: 1106.74,
  //   heading: 315.9337768555,
  //   pitch: -23.1623802185,
  //   roll: 0.0,
  // });

  showAttributions([
    TERRAIN_DATASETS.gsi,
    TILE_DATASETS.gsiSeamlessphoto,
    TILES_3D_DATASETS.plateauToranomonHillsBIM,
  ]);
};
