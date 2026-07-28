import ThreeView, { Color } from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";

import { TERRAIN_DATASETS, TILE_DATASETS } from "../../helpers/constants";
import { addCtrlPanel } from "../../helpers/panel";

export const run = async (view: ThreeView<DefaultDescriptions>) => {
  const attribution = view.attribution;

  view.addPlugin(new DefaultPlugin());

  await view.init();

  view.addLight({ ambient: {} });

  const terrainSource = view.addSource({
    type: "quantized-mesh",
    url: TERRAIN_DATASETS.reearthQuantizedMesh.url,
    maxZoom: 18,
    requestVertexNormals: true,
    requestWaterMask: true,
  });
  view.addLayer({
    type: "terrain",
    source: terrainSource,
    terrain: { castShadow: true, receiveShadow: true },
  });

  addCtrlPanel(
    [
      {
        type: "tiles",
        data: { url: TILE_DATASETS.openstreetmap.url },
        rasterTile: {
          color: new Color().setStyle("#ffffff"),
          maxZoom: 23,
          opacity: 1,
        },
      },
      {
        type: "tiles",
        data: { url: TILE_DATASETS.gsiStd.url },
        rasterTile: {
          color: new Color().setStyle("#ffffff"),
          maxZoom: 18,
          opacity: 1,
        },
      },
      {
        type: "tiles",
        data: { url: TILE_DATASETS.gsiSeamlessphoto.url },
        rasterTile: {
          color: new Color().setStyle("#ffffff"),
          maxZoom: 18,
          opacity: 1,
        },
      },
    ],
    view,
  );

  attribution?.add([
    TILE_DATASETS.openstreetmap,
    TILE_DATASETS.gsiStd,
    TILE_DATASETS.gsiSeamlessphoto,
    TERRAIN_DATASETS.reearthQuantizedMesh,
  ]);
};
