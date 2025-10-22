import ThreeView, {
  LLE,
  degreeToRadian,
  geodeticToVector3,
} from "@navara/three";
import { Vector3 } from "three";

import { showAttributions } from "../../helpers/attributions";
import { TILE_DATASETS } from "../../helpers/constants";

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
      intensity: 1.2,
      applyColor: true,
      castShadow: true,
    },
  });

  // Add TestSelectiveEffectLayer with debug mask
  const testSelectiveEffect = view.addLayer({
    type: "effect",
    testSelective: {
      debugMask: true,
      resolutionScale: 1.0,
    },
  });

  // Add cube mesh with selective effect
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
    },
    position: {
      x: spherePosition.x,
      y: spherePosition.y,
      z: spherePosition.z,
    },
    effects: [testSelectiveEffect.id],
  });

  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    raster_tile: {
      max_zoom: 23,
    },
  });

  showAttributions([TILE_DATASETS.openstreetmap]);
};
