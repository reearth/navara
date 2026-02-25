import ThreeView, {
  Color,
  JAPAN_GSI_ELEVATION_DECODER,
  degreeToRadian,
  geodeticToVector3,
  type LayerHandle,
  type SelectiveEffectOcclusion,
  Layer,
} from "@navara/three";
import type {
  BoxMeshLayer,
  CylinderMeshLayer,
  PlaneMeshLayer,
  SphereMeshLayer,
  TubeMeshLayer,
} from "@navara/three_default_layers";
import type { DefaultLayerDescriptions } from "@navara/three_default_plugin";
import type { FeatureCollection } from "geojson";
import { Vector3 } from "three";

import {
  TERRAIN_DATASETS,
  TILE_DATASETS,
  TILES_3D_DATASETS,
} from "../../../helpers/constants";

// ============================================
// Initial Configurations (Single Source of Truth)
// ============================================

/**
 * Cube mesh initial configuration
 */
export const CUBE_CONFIG = {
  emissiveColor: new Color().setHex(0xff0000),
  emissiveIntensity: 1.0,
  selectiveEffectOcclusion: "normal" satisfies SelectiveEffectOcclusion,
  bloomEnabled: true,
  outlineEnabled: false,
} as const;

/**
 * Sphere mesh initial configuration
 */
export const SPHERE_CONFIG = {
  emissiveColor: new Color().setHex(0x00aaff),
  emissiveIntensity: 1.0,
  selectiveEffectOcclusion: "normal" satisfies SelectiveEffectOcclusion,
  bloomEnabled: true,
  outlineEnabled: false,
} as const;

/**
 * Cylinder mesh initial configuration (新宿)
 */
export const CYLINDER_CONFIG = {
  emissiveColor: new Color().setHex(0x00ff00),
  emissiveIntensity: 0.5,
  selectiveEffectOcclusion: "normal" satisfies SelectiveEffectOcclusion,
  bloomEnabled: true,
  outlineEnabled: false,
} as const;

/**
 * Tube mesh initial configuration (渋谷)
 */
export const TUBE_CONFIG = {
  emissiveColor: new Color().setHex(0xffff00),
  emissiveIntensity: 0.5,
  selectiveEffectOcclusion: "normal" satisfies SelectiveEffectOcclusion,
  bloomEnabled: true,
  outlineEnabled: false,
} as const;

/**
 * Plane mesh initial configuration (秋葉原)
 */
export const PLANE_CONFIG = {
  emissiveColor: new Color().setHex(0xff00ff),
  emissiveIntensity: 0.5,
  selectiveEffectOcclusion: "normal" satisfies SelectiveEffectOcclusion,
  bloomEnabled: true,
  outlineEnabled: false,
} as const;

/**
 * Chiyoda buildings initial configuration
 */
export const CHIYODA_CONFIG = {
  baseColor: 0xffffff,
  emissiveColor: new Color().setHex(0xffffff),
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
  emissiveColor: new Color().setHex(0xffffff),
  emissiveIntensity: 0.3,
  selectiveEffectOcclusion: "normal" satisfies SelectiveEffectOcclusion,
  bloomEnabled: false,
  outlineEnabled: false,
} as const;

/**
 * GeoJSON Polygon initial configuration (お台場)
 */
export const POLYGON_CONFIG = {
  color: 0xffa500,
  emissiveColor: new Color().setHex(0xffa500),
  emissiveIntensity: 0.5,
  selectiveEffectOcclusion: "normal" satisfies SelectiveEffectOcclusion,
  bloomEnabled: true,
  outlineEnabled: false,
} as const;

// ============================================
// Camera Focus Positions
// ============================================

export type CameraPosition = {
  lng: number;
  lat: number;
  height: number;
  heading: number;
  pitch: number;
  roll: number;
};

export const CAMERA_FOCUS_POSITIONS = {
  cube: {
    lng: 139.767125,
    lat: 35.676,
    height: 800,
    heading: 0,
    pitch: -35,
    roll: 0,
  },
  sphere: {
    lng: 139.762,
    lat: 35.676,
    height: 700,
    heading: 100,
    pitch: -40,
    roll: 0,
  },
  cylinder: {
    lng: 139.6917,
    lat: 35.684,
    height: 1000,
    heading: 0,
    pitch: -40,
    roll: 0,
  },
  tube: {
    lng: 139.7016,
    lat: 35.65,
    height: 800,
    heading: 0,
    pitch: -45,
    roll: 0,
  },
  plane: {
    lng: 139.7731,
    lat: 35.693,
    height: 800,
    heading: 0,
    pitch: -40,
    roll: 0,
  },
  polygon: {
    lng: 139.775,
    lat: 35.623,
    height: 800,
    heading: 0,
    pitch: -40,
    roll: 0,
  },
  chiyoda: {
    lng: 139.7511,
    lat: 35.6736,
    height: 902,
    heading: 64.4,
    pitch: -36,
    roll: 0,
  },
  chuo: {
    lng: 139.772,
    lat: 35.673,
    height: 1000,
    heading: -30,
    pitch: -40,
    roll: 0,
  },
} as const satisfies Record<string, CameraPosition>;

export type GeoJsonPolygonState = {
  show: boolean;
  color: Color;
  extrudedHeight: number;
  clampToGround?: boolean;
  effectIds?: string[];
  emissiveColor?: Color;
  emissiveIntensity?: number;
  selectiveEffectOcclusion?: SelectiveEffectOcclusion;
};

export type GeoJsonPolygonLayer = {
  layer: Layer;
  updatePolygon: (overrides: Partial<GeoJsonPolygonState>) => void;
};

export type SceneLayers = {
  cubeLayer: LayerHandle<BoxMeshLayer>;
  sphereLayer: LayerHandle<SphereMeshLayer>;
  cylinderLayer: LayerHandle<CylinderMeshLayer>;
  tubeLayer: LayerHandle<TubeMeshLayer>;
  planeLayer: LayerHandle<PlaneMeshLayer>;
  polygonLayer: GeoJsonPolygonLayer;
  chiyodaLayer: Layer;
  chuoLayer: Layer;
};

export type EffectIds = {
  bloomId: string;
  outlineId: string;
};

export const createSceneLayers = (
  view: ThreeView<DefaultLayerDescriptions>,
  effectIds: EffectIds,
): SceneLayers => {
  const tokyoStationPosition = geodeticToVector3({
    lat: degreeToRadian(35.681236),
    lng: degreeToRadian(139.767125),
    height: 200,
  });

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

  // Cylinder at Shinjuku (新宿)
  const shinjukuPosition = geodeticToVector3({
    lat: degreeToRadian(35.6896),
    lng: degreeToRadian(139.6917),
    height: 200,
  });

  const cylinderLayer = view.addLayer<CylinderMeshLayer>({
    type: "mesh",
    cylinder: {
      radiusTop: 50,
      radiusBottom: 50,
      height: 300,
      radialSegments: 32,
      color: new Color().setHex(0x00ff00),
      emissiveColor: CYLINDER_CONFIG.emissiveColor,
      emissiveIntensity: CYLINDER_CONFIG.emissiveIntensity,
      opacity: 1.0,
      transparent: true,
      castShadow: true,
      receiveShadow: true,
    },
    position: {
      x: shinjukuPosition.x,
      y: shinjukuPosition.y,
      z: shinjukuPosition.z,
    },
    selectiveEffectOcclusion: "normal",
  });

  // Tube at Shibuya (渋谷)
  const shibuyaPosition = geodeticToVector3({
    lat: degreeToRadian(35.658),
    lng: degreeToRadian(139.7016),
    height: 150,
  });

  // Create a curved path for the tube
  const tubePoints = [
    { x: shibuyaPosition.x, y: shibuyaPosition.y, z: shibuyaPosition.z },
    {
      x: shibuyaPosition.x + 100,
      y: shibuyaPosition.y + 50,
      z: shibuyaPosition.z + 100,
    },
    {
      x: shibuyaPosition.x + 200,
      y: shibuyaPosition.y + 100,
      z: shibuyaPosition.z,
    },
    {
      x: shibuyaPosition.x + 300,
      y: shibuyaPosition.y + 50,
      z: shibuyaPosition.z - 100,
    },
    {
      x: shibuyaPosition.x + 400,
      y: shibuyaPosition.y,
      z: shibuyaPosition.z,
    },
  ];

  const tubeLayer = view.addLayer<TubeMeshLayer>({
    type: "mesh",
    tube: {
      points: tubePoints,
      radius: 15,
      tubularSegments: 64,
      radialSegments: 16,
      closed: false,
      tension: 0.5,
      color: new Color().setHex(0xffff00),
      emissiveColor: TUBE_CONFIG.emissiveColor,
      emissiveIntensity: TUBE_CONFIG.emissiveIntensity,
      opacity: 1.0,
      transparent: true,
      castShadow: true,
      receiveShadow: true,
    },
    selectiveEffectOcclusion: "normal",
  });

  // Plane at Akihabara (秋葉原)
  const akihabaraPosition = geodeticToVector3({
    lat: degreeToRadian(35.6984),
    lng: degreeToRadian(139.7731),
    height: 150,
  });

  const planeLayer = view.addLayer<PlaneMeshLayer>({
    type: "mesh",
    plane: {
      width: 200,
      height: 200,
      color: new Color().setHex(0xff00ff),
      emissiveColor: PLANE_CONFIG.emissiveColor,
      emissiveIntensity: PLANE_CONFIG.emissiveIntensity,
      opacity: 1.0,
      transparent: true,
      castShadow: true,
      receiveShadow: true,
    },
    position: {
      x: akihabaraPosition.x,
      y: akihabaraPosition.y,
      z: akihabaraPosition.z,
    },
    rotation: {
      x: -Math.PI / 2, // Rotate to horizontal
      y: 0,
      z: 0,
    },
    selectiveEffectOcclusion: "normal",
  });

  // GeoJSON Polygon at Odaiba (お台場)
  const odaibaFeature: FeatureCollection = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [139.773, 35.628],
              [139.777, 35.628],
              [139.777, 35.631],
              [139.773, 35.631],
              [139.773, 35.628],
            ],
          ],
        },
      },
    ],
  };

  // Compute initial effectIds based on POLYGON_CONFIG
  const polygonEffectIds: string[] = [];
  if (POLYGON_CONFIG.bloomEnabled) polygonEffectIds.push(effectIds.bloomId);
  if (POLYGON_CONFIG.outlineEnabled) polygonEffectIds.push(effectIds.outlineId);

  const polygonLayer = createGeoJsonPolygonLayer({
    view,
    feature: odaibaFeature,
    polygon: {
      show: true,
      color: new Color().setHex(POLYGON_CONFIG.color),
      extrudedHeight: 80,
      clampToGround: false, // Required for SelectiveEffect (MRT scene)
      effectIds: polygonEffectIds,
      emissiveColor: POLYGON_CONFIG.emissiveColor,
      emissiveIntensity: POLYGON_CONFIG.emissiveIntensity,
      selectiveEffectOcclusion: POLYGON_CONFIG.selectiveEffectOcclusion,
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
    cylinderLayer,
    tubeLayer,
    planeLayer,
    polygonLayer,
    chiyodaLayer,
    chuoLayer,
  };
};

type CreateGeoJsonPolygonLayerOptions = {
  view: ThreeView<DefaultLayerDescriptions>;
  feature: FeatureCollection;
  polygon: GeoJsonPolygonState;
};

const createGeoJsonPolygonLayer = ({
  view,
  feature,
  polygon,
}: CreateGeoJsonPolygonLayerOptions): GeoJsonPolygonLayer => {
  const currentState = { ...polygon };

  const layer = view.addLayer({
    type: "geojson",
    data: feature,
    polygon: currentState,
  });

  const updatePolygon = (overrides: Partial<GeoJsonPolygonState>) => {
    Object.assign(currentState, overrides);
    layer.update({
      type: "geojson",
      data: feature,
      polygon: { ...currentState },
    });
  };

  return {
    layer,
    updatePolygon,
  };
};
