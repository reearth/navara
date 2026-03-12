import type { NormalizeWASMClass, Nullable, TileHandle } from "@navara/core";
import type {
  B3dmLayerDescription,
  PntsLayerDescription,
  Cesium3dTilesLayerDescription,
  GeoJsonLayerDescription,
  TerrainLayerDescription,
  TileLayerDescription,
  MvtLayerDescription,
} from "@navara/engine";
import type { Promise as WorkerPoolPromise } from "@navara/worker";
import type { Mesh, Sprite, Object3D, Material } from "three";

import type { Color } from "../Color";
import type { LightLayerConfig } from "../core";
import type {
  FinalCopyPassConfig,
  MRTPassConfig,
  SelectiveBloomEffectConfig,
  SelectiveOutlineEffectConfig,
  SkyEnvMapPassConfig,
  TransparentPassConfig,
} from "../layers/effect";
import type { TileMesh } from "../mesh";

export type { Promise as WorkerPoolPromise } from "@navara/worker";

export type LayerDescription =
  | ResourceLayerDescription
  | MeshLayerDeclarationDescription
  | LightLayerDeclarationDescription
  | EffectLayerDeclarationDescription;

export type MeshLayerDeclarationDescription = { type: "mesh" };

export type LightLayerDeclarationDescription = LightLayerConfig;

export type EffectLayerDeclarationDescription =
  | FinalCopyPassConfig
  | MRTPassConfig
  | SkyEnvMapPassConfig
  | SelectiveBloomEffectConfig
  | SelectiveOutlineEffectConfig
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

type Layer<LD> = NormalizeWASMClass<LD>;

/**
 * Helper type to add Navara Color object support to color-related number fields.
 * This recursively transforms any field named 'color' or ending with 'Color'
 * to accept both number and Navara Color objects.
 */
type ConvertColorFields<T> = {
  [K in keyof T]: K extends `${string}Color` | "color"
    ? T[K] extends number | undefined
      ? Color | undefined
      : T[K] extends number
        ? Color
        : T[K]
    : T[K] extends object | undefined
      ? ConvertColorFields<T[K]> | Extract<T[K], undefined>
      : T[K];
};

/**
 * Helper type to enable Navara Color objects in all color-related fields.
 * This applies to model, point, billboard, text, polyline, polygon, rasterTile, etc.
 * Both number and Navara Color objects are accepted for backward compatibility.
 */
type WithColorSupport<T> = ConvertColorFields<T>;

export type TilesLayer = WithColorSupport<
  Layer<TileLayerDescription & { type: "tiles" }>
>;
export type TerrainLayer = Layer<TerrainLayerDescription & { type: "terrain" }>;
export type GeoJsonLayer = WithColorSupport<
  Layer<GeoJsonLayerDescription & { type: "geojson" }>
>;
export type B3dmLayer = WithColorSupport<
  Layer<B3dmLayerDescription & { type: "b3dm" }>
>;
export type PntsLayer = WithColorSupport<
  Layer<PntsLayerDescription & { type: "pnts" }>
>;
export type Cesium3dTilesLayer = WithColorSupport<
  Layer<Cesium3dTilesLayerDescription & { type: "cesium3dtiles" }>
>;
export type MvtLayer = WithColorSupport<
  Layer<MvtLayerDescription & { type: "mvt" }>
>;

export type ResourceLayerDescription =
  | TilesLayer
  | TerrainLayer
  | GeoJsonLayer
  | B3dmLayer
  | PntsLayer
  | Cesium3dTilesLayer
  | MvtLayer;

export type MeshCache = Map<string, Mesh | Sprite | Object3D>;
export type DrapedMaterialCache = Map<string, Material>;

// Make a reference of TileMesh by TileHandle.
export type TileMapByHandle = Map<TileHandle, TileMesh>;

export type AbortControllers = Map<string, AbortController>;

export type WorkerPoolPromises = Map<string, WorkerPoolPromise<unknown>>;

export type PickedFeature = {
  properties: Nullable<Record<string, unknown>>;
  batchId: Nullable<number>;
  layerId: Nullable<string>;
};

export type RenderFlag = {
  forceUpdate: boolean;
  animation: boolean;
};
