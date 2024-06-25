import type { LayerDescription as LD } from "navara";

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

type Layer<T = { type: string }> = T & Omit<LD, "free" | "extent"> & { extent?: Extent };

export type TilesLayer = Layer<{ type: "tiles" }>;
export type TerrainLayer = Layer<{ type: "terrain" }>;
