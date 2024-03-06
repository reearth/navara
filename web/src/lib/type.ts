import type { LayerDescription as LD } from "map-engine-prototype";

import type { Extent } from "./utils";

export type { Extent } from "./utils";

export type LayerDescription = C3dtilesLayer | MVTLayer | TilesLayer;

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

export type TilesLayer = { type: "tiles" } & Omit<LD, "free" | "extent"> & { extent?: Extent };
