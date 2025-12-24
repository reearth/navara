import ThreeView, {
  Color,
  JAPAN_GSI_ELEVATION_DECODER,
  LLE,
  degreeToRadian,
  geodeticToVector3,
  type BoxMeshLayer,
  type LayerHandle,
  type SphereMeshLayer,
  type SelectiveEffectOcclusion,
  Layer,
} from "@navara/three";
import type { FeatureCollection } from "geojson";
import { Vector3 } from "three";

import {
  LOCAL_DATASETS,
  TERRAIN_DATASETS,
  TILE_DATASETS,
  TILES_3D_DATASETS,
} from "../../helpers/constants";

// ============================================
// Initial Configurations (Single Source of Truth)
// ============================================

/**
 * Cube mesh initial configuration
 */
export const CUBE_CONFIG = {
  emissiveColor: 0xff0000,
  emissiveIntensity: 1.0,
  selectiveEffectOcclusion: "normal" satisfies SelectiveEffectOcclusion,
  bloomEnabled: true,
  outlineEnabled: false,
} as const;

/**
 * Sphere mesh initial configuration
 */
export const SPHERE_CONFIG = {
  emissiveColor: 0x00aaff,
  emissiveIntensity: 1.0,
  selectiveEffectOcclusion: "normal" satisfies SelectiveEffectOcclusion,
  bloomEnabled: true,
  outlineEnabled: false,
} as const;

/**
 * Drum model initial configuration
 */
export const DRUM_CONFIG = {
  emissiveColor: 0xffffff,
  emissiveIntensity: 0.3,
  selectiveEffectOcclusion: "normal" satisfies SelectiveEffectOcclusion,
  bloomEnabled: false,
  outlineEnabled: false,
} as const;

/**
 * Soldier model initial configuration
 */
export const SOLDIER_CONFIG = {
  emissiveColor: 0xffffff,
  emissiveIntensity: 0.3,
  animationSpeed: 1.0,
  selectiveEffectOcclusion: "normal" satisfies SelectiveEffectOcclusion,
  bloomEnabled: false,
  outlineEnabled: false,
} as const;

/**
 * Chiyoda buildings initial configuration
 */
export const CHIYODA_CONFIG = {
  baseColor: 0xffffff,
  emissiveColor: 0xffffff,
  emissiveIntensity: 0.3,
  selectiveEffectOcclusion: "normal" satisfies SelectiveEffectOcclusion,
  bloomEnabled: true,
  outlineEnabled: true,
} as const;

/**
 * Chuo buildings initial configuration
 */
export const CHUO_CONFIG = {
  baseColor: 0xffffff,
  emissiveColor: 0xffffff,
  emissiveIntensity: 0.3,
  selectiveEffectOcclusion: "normal" satisfies SelectiveEffectOcclusion,
  bloomEnabled: false,
  outlineEnabled: false,
} as const;

type GeoJsonModelState = Record<string, unknown>;

export type GeoJsonModelLayer<TState extends GeoJsonModelState> = {
  layer: Layer;
  updateModel: (overrides: Partial<TState>) => void;
};

export type DrumModelState = {
  show: boolean;
  size: number;
  height: number;
  clampToGround: boolean;
  url: string;
  shouldRotateInDefault: boolean;
  color?: number;
  emissiveColor?: number;
  emissiveIntensity?: number;
  selectiveEffectOcclusion?: SelectiveEffectOcclusion;
};

export type SoldierModelState = {
  show: boolean;
  size: number;
  height: number;
  clampToGround: boolean;
  url: string;
  animationActiveClip?: string;
  animationSpeed?: number;
  color?: number;
  emissiveColor?: number;
  emissiveIntensity?: number;
  selectiveEffectOcclusion?: SelectiveEffectOcclusion;
};

export type SceneLayers = {
  cubeLayer: LayerHandle<BoxMeshLayer>;
  sphereLayer: LayerHandle<SphereMeshLayer>;
  drumLayer: GeoJsonModelLayer<DrumModelState>;
  soldierLayer: GeoJsonModelLayer<SoldierModelState>;
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
      color: new Color().setHex(0xff0000),
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
    selectiveEffectOcclusion: "normal",
  });

  const sphereLayer = view.addLayer<SphereMeshLayer>({
    type: "mesh",
    sphere: {
      radius: 100,
      color: new Color().setHex(0x00aaff),
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
    selectiveEffectOcclusion: "normal",
  });

  const drumLayer = createGeoJsonModelLayer<DrumModelState>({
    view,
    feature: {
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
      clampToGround: true,
      url: LOCAL_DATASETS.steelDrumGLTF.url,
      shouldRotateInDefault: true,
      emissiveColor: 0xffffff,
      emissiveIntensity: 0.3,
      selectiveEffectOcclusion: "normal",
    },
  });

  const soldierLayer = createGeoJsonModelLayer<SoldierModelState>({
    view,
    feature: {
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
      clampToGround: true,
      url: LOCAL_DATASETS.soldierGLTF.url,
      animationActiveClip: "Walk",
      animationSpeed: 1.0,
      emissiveColor: 0xffffff,
      emissiveIntensity: 0.3,
      selectiveEffectOcclusion: "normal",
    },
  });

  view.addLayer({
    type: "terrain",
    data: {
      url: TERRAIN_DATASETS.gsi.url,
    },
    rasterTerrain: {
      maxZoom: 15,
      minZoom: 5,
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
      castShadow: true,
      receiveShadow: true,
    },
  });

  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: {
      maxZoom: 23,
    },
  });

  const chiyodaLayer = view.addLayer({
    type: "cesium3dtiles",
    data: {
      url: TILES_3D_DATASETS.plateauChiyoda.url,
    },
    model: {
      show: true,
      color: new Color().setHex(0xffffff),
      metalness: 0.1,
      roughness: 0.1,
      castShadow: true,
      receiveShadow: true,
      selectiveEffectOcclusion: "normal",
    },
  });

  const chuoLayer = view.addLayer({
    type: "cesium3dtiles",
    data: {
      url: TILES_3D_DATASETS.plateauChuo.url,
    },
    model: {
      show: true,
      color: new Color().setHex(0xffffff),
      metalness: 0.1,
      roughness: 0.1,
      castShadow: true,
      receiveShadow: true,
      selectiveEffectOcclusion: "normal",
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

type CreateGeoJsonModelLayerOptions<TState extends GeoJsonModelState> = {
  view: ThreeView;
  feature: FeatureCollection;
  model: TState;
};

const createGeoJsonModelLayer = <TState extends GeoJsonModelState>({
  view,
  feature,
  model,
}: CreateGeoJsonModelLayerOptions<TState>): GeoJsonModelLayer<TState> => {
  const currentModelState = { ...model };

  const layer = view.addLayer({
    type: "geojson",
    data: feature,
    model: currentModelState,
  });

  const updateModel = (overrides: Partial<TState>) => {
    Object.assign(currentModelState, overrides);
    layer.update({
      type: "geojson",
      data: feature,
      model: { ...currentModelState },
    });
  };

  return {
    layer,
    updateModel,
  };
};
