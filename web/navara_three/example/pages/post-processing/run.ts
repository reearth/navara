import ThreeView, { type Layer } from "@navara/three";

import { showAttributions } from "../../helpers/attributions";
import {
  TILE_DATASETS,
  TILES_3D_DATASETS,
  TERRAIN_DATASETS,
  LOCAL_DATASETS,
} from "../../helpers/constants";

import { createControlPane } from "./controlPane";
import { createSceneLayers } from "./sceneLayers";

export type PostEffects = {
  postEffectOutline: Layer;
  postEffectBloom: Layer;
};

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

  // Post effects setup
  const postEffectOutline = view.addLayer({
    type: "effect",
    postEffectOutline: {
      color: 0xff0000,
      thickness: 2.0,
      edgeStrength: 1.0,
    },
    debugMask: false,
    resolutionScale: 1.0,
  });

  const postEffectBloom = view.addLayer({
    type: "effect",
    postEffectBloom: {
      strength: 0.1,
      radius: 0.5,
      threshold: 0.0,
      debugMode: 0,
    },
    debugMask: true,
    resolutionScale: 1.0,
  });

  view.addDefaultEffectLayers();
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

  createControlPane({
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
