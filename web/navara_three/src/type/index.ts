import type { TileHandle } from "@navara/core";
import type {
  B3dmLayerDescription,
  Cesium3dTilesLayerDescription,
  GeoJsonLayerDescription,
  TerrainLayerDescription,
  TileLayerDescription,
  MvtLayerDescription,
} from "@navara/engine";
import type { Promise as WorkerPoolPromise } from "@navara/worker";
import type { Mesh, Sprite, Object3D, Material } from "three";

import type {
  RainMeshLayerConfig,
  SnowMeshLayerConfig,
  SkyMeshLayerConfig,
  StarsLayerConfig,
  BoxMeshLayerConfig,
  SphereMeshLayerConfig,
  CylinderMeshLayerConfig,
  PlaneMeshLayerConfig,
  GLTFModelLayerConfig,
  AxesHelperLayerConfig,
  ArrowHelperLayerConfig,
  SunLightLayerConfig,
  SkyLightProbeLayerConfig,
  AmbientLightLayerConfig,
  LightProbeLayerConfig,
  TubeMeshLayerConfig,
  ArclineMeshLayerConfig,
} from "../layers";
import type {
  AerialPerspectiveConfig,
  CloudsConfig,
  FinalCopyPassConfig,
  FogLightConfig,
  FXAAConfig,
  LensFlareConfig,
  MRTPassConfig,
  RainDropConfig,
  SMAAConfig,
  SSAOConfig,
  SSRConfig,
  ToneMappingConfig,
  TransparentPassConfig,
} from "../layers/effect";
import type { TileMesh } from "../mesh";

export type { Promise as WorkerPoolPromise } from "@navara/worker";

export type LayerDescription =
  // | MVTLayer
  | TilesLayer
  | TerrainLayer
  | GeoJsonLayer
  | B3dmLayer
  | Cesium3dTilesLayer
  | MvtLayer
  | MeshLayerDeclarationDescription
  | LightLayerDeclarationDescription
  | EffectLayerDeclarationDescription;

export type MeshLayerDeclarationDescription =
  | RainMeshLayerConfig
  | SnowMeshLayerConfig
  | SkyMeshLayerConfig
  | StarsLayerConfig
  | BoxMeshLayerConfig
  | SphereMeshLayerConfig
  | CylinderMeshLayerConfig
  | TubeMeshLayerConfig
  | PlaneMeshLayerConfig
  | GLTFModelLayerConfig
  | AxesHelperLayerConfig
  | ArrowHelperLayerConfig
  | ArclineMeshLayerConfig;

export type LightLayerDeclarationDescription =
  | SunLightLayerConfig
  | SkyLightProbeLayerConfig
  | AmbientLightLayerConfig
  | LightProbeLayerConfig;

export type EffectLayerDeclarationDescription =
  | AerialPerspectiveConfig
  | CloudsConfig
  | FinalCopyPassConfig
  | FogLightConfig
  | FXAAConfig
  | LensFlareConfig
  | MRTPassConfig
  | RainDropConfig
  | SMAAConfig
  | SSAOConfig
  | SSRConfig
  | ToneMappingConfig
  | TransparentPassConfig;

// export type MVTLayer = {
//   type: "mvt";
//   zoom: number;
//   layers?: string[];
//   height?: number;
//   extent?: Extent;
//   url: string;
//   color?: number;
// };

type RemoveFreeRecursively<T> = T extends { free: any }
  ? Omit<{ [K in keyof T]: RemoveFreeRecursively<T[K]> }, "free">
  : T;

// wasm-bindgen generate a getter and setter, so need to extract it as a property.
export type ExtractProperties<T> = {
  [K in keyof T]?: T[K] extends (...args: any) => any
    ? ReturnType<T[K]> extends (...args: any) => any
      ? ExtractProperties<ReturnType<T[K]>>
      : ReturnType<T[K]>
    : Partial<T[K]>;
};

type Layer<LD> = ExtractProperties<RemoveFreeRecursively<LD>>;

export type TilesLayer = Layer<TileLayerDescription & { type: "tiles" }>;
export type TerrainLayer = Layer<TerrainLayerDescription & { type: "terrain" }>;
export type GeoJsonLayer = Layer<GeoJsonLayerDescription & { type: "geojson" }>;
export type B3dmLayer = Layer<B3dmLayerDescription & { type: "b3dm" }>;
export type Cesium3dTilesLayer = Layer<
  Cesium3dTilesLayerDescription & { type: "cesium3dtiles" }
>;
export type MvtLayer = Layer<MvtLayerDescription & { type: "mvt" }>;

export type MeshCache = Map<string, Mesh | Sprite | Object3D>;
export type DrapedMaterialCache = Map<string, Material>;

// Make a reference of TileMesh by TileHandle.
export type TileMapByHandle = Map<TileHandle, TileMesh>;

export type AbortControllers = Map<string, AbortController>;

export type WorkerPoolPromises = Map<string, WorkerPoolPromise<unknown>>;

export type PickedFeature = {
  properties: Map<string, unknown>;
};

export type RenderFlag = {
  forceUpdate: boolean;
  animation: boolean;
};
