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
  
  // Add SelectiveOutlineEffectLayer with debug mask
  const selectiveOutline = view.addLayer({
    type: "effect",
    selectiveOutline: {
      color: 0x0000ff,        // Blue outline (for future use)
      thickness: 2.0,         // Outline thickness (for future use)
      edgeStrength: 1.0,      // Edge detection strength (for future use)
    },
    debugMask: true,          // Show mask in top-left corner
    resolutionScale: 1.0,
  });

  // Add default effect layers for proper rendering (Tone Mapping, SMAA, etc.)
  view.addDefaultEffectLayers();

  // Add cube mesh with selective effect (depthTest enabled)
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
    effects: [selectiveOutline.id],  // depthTest enabled (default)
  });

  // Add sphere mesh with selective effect (depthTest enabled)
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
    effects: [selectiveOutline.id],  // depthTest enabled (default)
  });

  // Add GeoJSON drum model near Tokyo Station with selective effect
  // ignoreDepth: true to avoid depth noise from complex geometry
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
    effects: [selectiveOutline.id],
    //ignoreDepth: true,  // Ignore depth for complex models
  });

  // Add GeoJSON animated soldier model near Imperial Palace with selective effect
  // ignoreDepth: true to avoid depth noise from complex geometry
  view.addLayer({
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            coordinates: [139.7505, 35.677],
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
      url: LOCAL_DATASETS.soldierGLTF.url,
      animation_active_clip: "Walk",
      animation_speed: 1.0,
      color: 0xffffff,
      metalness: 0.1,
      roughness: 0.1,
    },
    //effects: [selectiveOutline.id],
    //ignoreDepth: true,  // Ignore depth for complex models
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

  // Add 3D building models for Tokyo area with selective outline effect
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
    //effects: [selectiveOutline.id],  // ← ここにeffects配列を追加
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
    //effects: [selectiveOutline.id],  // ← ここにeffects配列を追加
    
  });

  showAttributions([
    TILE_DATASETS.openstreetmap,
    TERRAIN_DATASETS.gsi,
    TILES_3D_DATASETS.plateauChiyoda,
    TILES_3D_DATASETS.plateauChuo,
    LOCAL_DATASETS.steelDrumGLTF,
  ]);
};
