import ThreeView from "@navara/three";

import { showAttributions } from "../../helpers/attributions";
import {
  TILE_DATASETS,
  TILES_3D_DATASETS,
  TERRAIN_DATASETS,
  LOCAL_DATASETS,
} from "../../helpers/constants";

import { createPostProcessingPane } from "./controls/createPostProcessingPane";
import { setupPostEffects } from "./effects/setupSelectiveEffects";
import { createSceneLayers } from "./layers/createSceneLayers";

export const run = async (view: ThreeView) => {
  await view.init();

  view.setCamera({
    lng: 139.7511145474829,
    lat: 35.67364356091717,
    height: 902.0,
    heading: 64.41840149763287,
    pitch: -36.00000121921312,
    roll: 0,
  });

  const defaultAtmosphere = view.addDefaultAtmosphereLayers();
  defaultAtmosphere.sun.update({
    sun: {
      intensity: 1,
      castShadow: true,
    },
  });

  // Set time to 8:00 AM (same as debug page)
  const date = new Date();
  date.setHours(8);
  view.atmosphere.date = date;

  const { postEffectOutline, postEffectBloom } = setupPostEffects(view);
  const {
    cubeLayer,
    sphereLayer,
    drumLayer,
    soldierLayer,
    chiyodaLayer,
    chuoLayer,
  } = createSceneLayers(view);

  showAttributions([
    TILE_DATASETS.openstreetmap,
    TERRAIN_DATASETS.gsi,
    TILES_3D_DATASETS.plateauChiyoda,
    TILES_3D_DATASETS.plateauChuo,
    LOCAL_DATASETS.steelDrumGLTF,
  ]);

  createPostProcessingPane({
    postEffectOutline,
    postEffectBloom,
    cubeLayer,
    sphereLayer,
    drumLayer,
    soldierLayer,
    chiyodaLayer,
    chuoLayer,
  });
};
