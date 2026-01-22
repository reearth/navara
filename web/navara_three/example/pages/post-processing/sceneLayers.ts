import ThreeView, {
  Color,
  JAPAN_GSI_ELEVATION_DECODER,
  LLE,
  degreeToRadian,
  geodeticToVector3,
  type BoxMeshLayer,
  type CylinderMeshLayer,
  type LayerHandle,
  type PlaneMeshLayer,
  type SphereMeshLayer,
  type TubeMeshLayer,
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
 * Cylinder mesh initial configuration (新宿)
 */
export const CYLINDER_CONFIG = {
  emissiveColor: 0x00ff00,
  emissiveIntensity: 0.5,
  selectiveEffectOcclusion: "normal" satisfies SelectiveEffectOcclusion,
  bloomEnabled: true,
  outlineEnabled: false,
} as const;

/**
 * Tube mesh initial configuration (渋谷)
 */
export const TUBE_CONFIG = {
  emissiveColor: 0xffff00,
  emissiveIntensity: 0.5,
  selectiveEffectOcclusion: "normal" satisfies SelectiveEffectOcclusion,
  bloomEnabled: true,
  outlineEnabled: false,
} as const;

/**
 * Plane mesh initial configuration (秋葉原)
 */
export const PLANE_CONFIG = {
  emissiveColor: 0xff00ff,
  emissiveIntensity: 0.5,
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

/**
 * GeoJSON Polygon initial configuration (お台場)
 */
export const POLYGON_CONFIG = {
  color: 0xffa500,
  emissiveColor: 0xffa500,
  emissiveIntensity: 0.5,
  selectiveEffectOcclusion: "normal" satisfies SelectiveEffectOcclusion,
  bloomEnabled: true,
  outlineEnabled: false,
} as const;

/**
 * GeoJSON Point initial configuration (上野〜浅草)
 */
export const POINT_CONFIG = {
  color: 0x00ffff,
  size: 0.01,
  emissiveColor: 0x00ffff,
  emissiveIntensity: 0.5,
  selectiveEffectOcclusion: "normal" satisfies SelectiveEffectOcclusion,
  bloomEnabled: true,
  outlineEnabled: false,
} as const;

/**
 * GeoJSON Polyline initial configuration (六本木)
 */
export const POLYLINE_CONFIG = {
  color: 0xff00ff,
  width: 10,
  emissiveColor: 0xff00ff,
  emissiveIntensity: 0.5,
  selectiveEffectOcclusion: "normal" satisfies SelectiveEffectOcclusion,
  bloomEnabled: true,
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

export type GeoJsonPointState = {
  show: boolean;
  color: Color;
  size: number;
  clampToGround?: boolean;
  effectIds?: string[];
  emissiveColor?: Color;
  emissiveIntensity?: number;
  selectiveEffectOcclusion?: SelectiveEffectOcclusion;
};

export type GeoJsonPointLayer = {
  layer: Layer;
  updatePoint: (overrides: Partial<GeoJsonPointState>) => void;
};

export type GeoJsonPolylineState = {
  show: boolean;
  color: Color;
  width: number;
  clampToGround?: boolean;
  effectIds?: string[];
  emissiveColor?: Color;
  emissiveIntensity?: number;
  selectiveEffectOcclusion?: SelectiveEffectOcclusion;
};

export type GeoJsonPolylineLayer = {
  layer: Layer;
  updatePolyline: (overrides: Partial<GeoJsonPolylineState>) => void;
};

export type SceneLayers = {
  cubeLayer: LayerHandle<BoxMeshLayer>;
  sphereLayer: LayerHandle<SphereMeshLayer>;
  cylinderLayer: LayerHandle<CylinderMeshLayer>;
  tubeLayer: LayerHandle<TubeMeshLayer>;
  planeLayer: LayerHandle<PlaneMeshLayer>;
  drumLayer: GeoJsonModelLayer<DrumModelState>;
  soldierLayer: GeoJsonModelLayer<SoldierModelState>;
  polygonLayer: GeoJsonPolygonLayer;
  pointLayer: GeoJsonPointLayer;
  polylineLayer: GeoJsonPolylineLayer;
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

  // Cylinder at Shinjuku (新宿)
  const shinjukuPosition = geodeticToVector3(
    new LLE(degreeToRadian(35.6896), degreeToRadian(139.6917), 200),
  );

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
  const shibuyaPosition = geodeticToVector3(
    new LLE(degreeToRadian(35.658), degreeToRadian(139.7016), 150),
  );

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
  const akihabaraPosition = geodeticToVector3(
    new LLE(degreeToRadian(35.6984), degreeToRadian(139.7731), 150),
  );

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

  const polygonLayer = createGeoJsonPolygonLayer({
    view,
    feature: odaibaFeature,
    polygon: {
      show: true,
      color: new Color().setHex(POLYGON_CONFIG.color),
      extrudedHeight: 80,
      clampToGround: false, // Required for SelectiveEffect (MRT scene)
      emissiveColor: new Color().setHex(POLYGON_CONFIG.emissiveColor),
      emissiveIntensity: POLYGON_CONFIG.emissiveIntensity,
      selectiveEffectOcclusion: POLYGON_CONFIG.selectiveEffectOcclusion,
    },
  });

  // GeoJSON Point at Ueno-Asakusa area (上野〜浅草)
  const uenoAsakusaFeature: FeatureCollection = {
    type: "FeatureCollection",
    features: [
      // Ueno Station
      {
        type: "Feature",
        properties: { name: "Ueno Station" },
        geometry: { type: "Point", coordinates: [139.7745, 35.7141] },
      },
      // Ueno Park
      {
        type: "Feature",
        properties: { name: "Ueno Park" },
        geometry: { type: "Point", coordinates: [139.7744, 35.7171] },
      },
      // Kaminarimon
      {
        type: "Feature",
        properties: { name: "Kaminarimon" },
        geometry: { type: "Point", coordinates: [139.7966, 35.7108] },
      },
      // Senso-ji Temple
      {
        type: "Feature",
        properties: { name: "Senso-ji" },
        geometry: { type: "Point", coordinates: [139.7966, 35.7148] },
      },
      // Tokyo Skytree
      {
        type: "Feature",
        properties: { name: "Skytree" },
        geometry: { type: "Point", coordinates: [139.8107, 35.7101] },
      },
    ],
  };

  const pointLayer = createGeoJsonPointLayer({
    view,
    feature: uenoAsakusaFeature,
    point: {
      show: true,
      color: new Color().setHex(POINT_CONFIG.color),
      size: POINT_CONFIG.size,
      clampToGround: false, // Required for SelectiveEffect (MRT scene)
      emissiveColor: new Color().setHex(POINT_CONFIG.emissiveColor),
      emissiveIntensity: POINT_CONFIG.emissiveIntensity,
      selectiveEffectOcclusion: POINT_CONFIG.selectiveEffectOcclusion,
    },
  });

  // GeoJSON Polyline at Roppongi (六本木)
  const roppongiFeature: FeatureCollection = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: "Roppongi Line" },
        geometry: {
          type: "LineString",
          coordinates: [
            [139.7292, 35.6628], // Roppongi Station
            [139.7315, 35.6652], // Roppongi Hills
            [139.7263, 35.6602], // Midtown
            [139.7305, 35.668], // National Art Center
            [139.735, 35.6665], // Tokyo Tower direction
          ],
        },
      },
    ],
  };

  const polylineLayer = createGeoJsonPolylineLayer({
    view,
    feature: roppongiFeature,
    polyline: {
      show: true,
      color: new Color().setHex(POLYLINE_CONFIG.color),
      width: POLYLINE_CONFIG.width,
      clampToGround: false, // Required for SelectiveEffect (MRT scene)
      emissiveColor: new Color().setHex(POLYLINE_CONFIG.emissiveColor),
      emissiveIntensity: POLYLINE_CONFIG.emissiveIntensity,
      selectiveEffectOcclusion: POLYLINE_CONFIG.selectiveEffectOcclusion,
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
    drumLayer,
    soldierLayer,
    polygonLayer,
    pointLayer,
    polylineLayer,
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

type CreateGeoJsonPolygonLayerOptions = {
  view: ThreeView;
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

type CreateGeoJsonPointLayerOptions = {
  view: ThreeView;
  feature: FeatureCollection;
  point: GeoJsonPointState;
};

const createGeoJsonPointLayer = ({
  view,
  feature,
  point,
}: CreateGeoJsonPointLayerOptions): GeoJsonPointLayer => {
  const currentState = { ...point };

  const layer = view.addLayer({
    type: "geojson",
    data: feature,
    point: currentState,
  });

  const updatePoint = (overrides: Partial<GeoJsonPointState>) => {
    Object.assign(currentState, overrides);
    layer.update({
      type: "geojson",
      data: feature,
      point: { ...currentState },
    });
  };

  return {
    layer,
    updatePoint,
  };
};

type CreateGeoJsonPolylineLayerOptions = {
  view: ThreeView;
  feature: FeatureCollection;
  polyline: GeoJsonPolylineState;
};

const createGeoJsonPolylineLayer = ({
  view,
  feature,
  polyline,
}: CreateGeoJsonPolylineLayerOptions): GeoJsonPolylineLayer => {
  const currentState = { ...polyline };

  const layer = view.addLayer({
    type: "geojson",
    data: feature,
    polyline: currentState,
  });

  const updatePolyline = (overrides: Partial<GeoJsonPolylineState>) => {
    Object.assign(currentState, overrides);
    layer.update({
      type: "geojson",
      data: feature,
      polyline: { ...currentState },
    });
  };

  return {
    layer,
    updatePolyline,
  };
};
