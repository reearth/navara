import type { TerrainLayerDescription, TileLayerDescription } from "navara";

import type { Extent } from "./utils";

export type { Extent } from "./utils";

export type LayerDescription = C3dtilesLayer | MVTLayer | TilesLayer | TerrainLayer;

export type C3dtilesLayer = { type: "3dtiles"; url: string };

export type MVTLayer = {
  type: "mvt";
  zoom: number;
  layers?: string[];
  height?: number;
  extent?: Extent;
  url: string;
  color?: number;
};

type RemoveFreeRecursively<T> = T extends { free: any }
  ? Omit<{ [K in keyof T]: RemoveFreeRecursively<T[K]> }, "free">
  : T;

type Layer<LD> = RemoveFreeRecursively<LD>;

export type TilesLayer = Layer<TileLayerDescription & { type: "tiles" }>;
export type TerrainLayer = Layer<TerrainLayerDescription & { type: "terrain" }>;
