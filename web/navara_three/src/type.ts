import type {
  B3dmLayerDescription,
  GeoJsonLayerDescription,
  TerrainLayerDescription,
  TileLayerDescription,
  MvtLayerDescription,
} from "navara";
import type { Mesh, Sprite, Object3D } from "three";

export type LayerDescription =
  | C3dtilesLayer
  | TilesLayer
  | TerrainLayer
  | GeoJsonLayer
  | B3dmLayer
  | MvtLayer;

export type C3dtilesLayer = { type: "3dtiles"; url: string };

type RemoveFreeRecursively<T> = T extends { free: any }
  ? Omit<{ [K in keyof T]: RemoveFreeRecursively<T[K]> }, "free">
  : T;

type Layer<LD> = RemoveFreeRecursively<LD>;

export type TilesLayer = Layer<TileLayerDescription & { type: "tiles" }>;
export type TerrainLayer = Layer<TerrainLayerDescription & { type: "terrain" }>;
export type GeoJsonLayer = Layer<GeoJsonLayerDescription & { type: "geojson" }>;
export type B3dmLayer = Layer<B3dmLayerDescription & { type: "b3dm" }>;
export type MvtLayer = Layer<MvtLayerDescription & { type: "mvt" }>;

export type MeshCache = Map<string, Mesh | Sprite | Object3D>;
