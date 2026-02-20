import ThreeView, { type Layer } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import { Color } from "three";

import { showAttributions } from "../../helpers/attributions";
import {
  TILE_DATASETS,
  TILES_3D_DATASETS,
  TERRAIN_DATASETS,
  LOCAL_DATASETS,
} from "../../helpers/constants";

import { createControlPane } from "./controlPane";
import { createSceneLayers } from "./sceneLayers";

export const BLOOM_CONFIG = {
  strength: 1.0,
  radius: 0.5,
  threshold: 0.0,
  debugMode: 0,
  debugViews: true,
  resolutionScale: 1.0,
} as const;

export type PostEffects = {
  postEffectOutline: Layer;
  postEffectBloom: Layer;
};

export const run = async (view: ThreeView) => {
  const plugin = new DefaultPlugin();
  view.addPlugin(plugin);
  await view.init();

  view.setCamera({
    lng: 139.7511145474829,
    lat: 35.67364356091717,
    height: 902.0,
    heading: 64.41840149763287,
    pitch: -36.00000121921312,
    roll: 0,
  });

  const defaultAtmosphere = plugin.addDefaultPhotorealLayers();
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
    selectiveOutline: {
      color: new Color().setHex(0xff0000),
      thickness: 2.0,
      edgeStrength: 1.0,
      debugViews: false,
      resolutionScale: 1.0,
    },
  });

  const postEffectBloom = view.addLayer({
    type: "effect",
    selectiveBloom: {
      strength: BLOOM_CONFIG.strength,
      radius: BLOOM_CONFIG.radius,
      threshold: BLOOM_CONFIG.threshold,
      debugMode: BLOOM_CONFIG.debugMode,
      debugViews: BLOOM_CONFIG.debugViews,
      resolutionScale: BLOOM_CONFIG.resolutionScale,
    },
  });

  view.addDefaultEffectLayers();
  const {
    cubeLayer,
    sphereLayer,
    cylinderLayer,
    tubeLayer,
    planeLayer,
    drumLayer,
    soldierLayer,
    polygonLayer,
    chiyodaLayer,
    chuoLayer,
  } = createSceneLayers(view, {
    bloomId: postEffectBloom.id,
    outlineId: postEffectOutline.id,
  });

  showAttributions([
    TILE_DATASETS.openstreetmap,
    TERRAIN_DATASETS.gsi,
    TILES_3D_DATASETS.plateauChiyoda,
    TILES_3D_DATASETS.plateauChuo,
    LOCAL_DATASETS.steelDrumGLTF,
  ]);

  createControlPane({
    view,
    postEffectOutline,
    postEffectBloom,
    cubeLayer,
    sphereLayer,
    cylinderLayer,
    tubeLayer,
    planeLayer,
    drumLayer,
    soldierLayer,
    polygonLayer,
    chiyodaLayer,
    chuoLayer,
  });
};
