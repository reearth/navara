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

  const osmSource = view.addSource({
    type: "raster-tile",
    url: TILE_DATASETS.openstreetmap.url,
    maxZoom: 23,
  });
  const gsiStdSource = view.addSource({
    type: "raster-tile",
    url: TILE_DATASETS.gsiStd.url,
    maxZoom: 18,
  });
  const gsiSeamlessphotoSource = view.addSource({
    type: "raster-tile",
    url: TILE_DATASETS.gsiSeamlessphoto.url,
    maxZoom: 18,
  });

  addCtrlPanel(
    [
      {
        type: "raster",
        source: osmSource,
        raster: {
          color: new Color().setStyle("#ffffff"),
          opacity: 1,
        },
      },
      {
        type: "raster",
        source: gsiStdSource,
        raster: {
          color: new Color().setStyle("#ffffff"),
          opacity: 1,
        },
      },
      {
        type: "raster",
        source: gsiSeamlessphotoSource,
        raster: {
          color: new Color().setStyle("#ffffff"),
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
