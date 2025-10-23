import ThreeView, {
  LLE,
  degreeToRadian,
  geodeticToVector3,
  JAPAN_GSI_ELEVATION_DECODER,
} from "@navara/three";
import { Vector3 } from "three";

import { showAttributions } from "../../helpers/attributions";
import {
  TILE_DATASETS,
  TILES_3D_DATASETS,
  TERRAIN_DATASETS,
  LOCAL_DATASETS,
} from "../../helpers/constants";

export const run = async (view: ThreeView) => {
  await view.init();

  const tokyoStationPosition = geodeticToVector3(
    new LLE(degreeToRadian(35.681236), degreeToRadian(139.767125), 200),
  );
  const cubePosition = tokyoStationPosition.clone().add(new Vector3(0, 0, 0));
  const spherePosition = tokyoStationPosition
    .clone()
    .add(new Vector3(-500, 0, -600));
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

  // Add TestSelectiveEffectLayer with debug mask
  const testSelectiveEffect = view.addLayer({
    type: "effect",
    testSelective: {
      debugMask: true,
      resolutionScale: 1.0,
    },
  });

  // Add default effect layers for proper rendering (Tone Mapping, SMAA, etc.)
  view.addDefaultEffectLayers();

  //Add cube mesh with selective effect
  view.addLayer({
    type: "mesh",
    box: {
      width: 200,
      height: 200,
      depth: 200,
      color: 0xff0000,
      emissive: 0x440000,
      emissiveIntensity: 0.9,
      opacity: 1.0,
      transparent: true,
      castShadow: true,
      receiveShadow: true,
    },
    position: {
      x: cubePosition.x,
      y: cubePosition.y,
      z: cubePosition.z,
    },
    effects: [testSelectiveEffect.id],
  });

  // Add sphere mesh with selective effect
  view.addLayer({
    type: "mesh",
    sphere: {
      radius: 100,
      color: 0x00aaff,
      emissive: 0x002244,
      emissiveIntensity: 0.9,
      opacity: 1.0,
      transparent: true,
      castShadow: true,
      receiveShadow: true,
    },
    position: {
      x: spherePosition.x,
      y: spherePosition.y,
      z: spherePosition.z,
    },
    effects: [testSelectiveEffect.id],
  });

  // Add GeoJSON model near Tokyo Station with selective effect
  view.addLayer({
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            coordinates: [139.7682, 35.6763],
            type: "Point",
          },
        },
      ],
    },
    model: {
      show: true,
      size: 100,
      height: 0,
      clamp_to_ground: true,
      url: LOCAL_DATASETS.steelDrumGLTF.url,
      should_rotate_in_default: true,
      color: 0xffffff,
      metalness: 0.1,
      roughness: 0.1,
    },
    effects: [testSelectiveEffect.id],
  });

  // Add terrain layer for Tokyo area
  view.addLayer({
    type: "terrain",
    data: {
      url: TERRAIN_DATASETS.gsi.url,
    },
    raster_terrain: {
      max_zoom: 15,
      min_zoom: 5,
      elevation_decoder: JAPAN_GSI_ELEVATION_DECODER(),
      cast_shadow: true,
      receive_shadow: true,
    },
  });

  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    raster_tile: {
      max_zoom: 23,
    },
  });

  // Add 3D building models for Tokyo area
  view.addLayer({
    type: "cesium3dtiles",
    data: {
      url: TILES_3D_DATASETS.plateauChiyoda.url,
    },
    model: {
      show: true,
      color: 0xffffff,
      metalness: 0.1,
      roughness: 0.1,
      cast_shadow: true,
      receive_shadow: true,
    },
  });

  view.addLayer({
    type: "cesium3dtiles",
    data: {
      url: TILES_3D_DATASETS.plateauChuo.url,
    },
    model: {
      show: true,
      color: 0xffffff,
      metalness: 0.1,
      roughness: 0.1,
      cast_shadow: true,
      receive_shadow: true,
    },
  });

  showAttributions([
    TILE_DATASETS.openstreetmap,
    TERRAIN_DATASETS.gsi,
    TILES_3D_DATASETS.plateauChiyoda,
    TILES_3D_DATASETS.plateauChuo,
    LOCAL_DATASETS.steelDrumGLTF,
  ]);
};
