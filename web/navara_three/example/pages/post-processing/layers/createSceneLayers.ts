import ThreeView, {
  JAPAN_GSI_ELEVATION_DECODER,
  LLE,
  degreeToRadian,
  geodeticToVector3,
  type BoxMeshLayer,
  type Layer,
  type LayerHandle,
  type SphereMeshLayer,
} from "@navara/three";
import { Vector3 } from "three";

import {
  LOCAL_DATASETS,
  TERRAIN_DATASETS,
  TILE_DATASETS,
  TILES_3D_DATASETS,
} from "../../../helpers/constants";

export type SceneLayers = {
  cubeLayer: LayerHandle<BoxMeshLayer>;
  sphereLayer: LayerHandle<SphereMeshLayer>;
  drumLayer: Layer;
  soldierLayer: Layer;
  chiyodaLayer: Layer;
  chuoLayer: Layer;
};

export const createSceneLayers = (view: ThreeView): SceneLayers => {
  const tokyoStationPosition = geodeticToVector3(
    new LLE(degreeToRadian(35.681236), degreeToRadian(139.767125), 200),
  );

  const cubePosition = tokyoStationPosition.clone().add(new Vector3(0, 0, 0));
  const spherePosition = tokyoStationPosition
    .clone()
    .add(new Vector3(-500, 0, -600));

  const cubeLayer = view.addLayer<BoxMeshLayer>({
    type: "mesh",
    box: {
      width: 200,
      height: 200,
      depth: 200,
      color: 0xff0000,
      emissiveIntensity: 1.0,
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
  });

  const sphereLayer = view.addLayer<SphereMeshLayer>({
    type: "mesh",
    sphere: {
      radius: 100,
      color: 0x00aaff,
      emissiveIntensity: 1.0,
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
  });

  const drumLayer = view.addLayer({
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
    },
    ignoreDepth: true,
  });

  const soldierLayer = view.addLayer({
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
    },
    ignoreDepth: true,
  });

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

  const chiyodaLayer = view.addLayer({
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

  const chuoLayer = view.addLayer({
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

  return {
    cubeLayer,
    sphereLayer,
    drumLayer,
    soldierLayer,
    chiyodaLayer,
    chuoLayer,
  };
};
