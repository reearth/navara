import ThreeView, { JAPAN_GSI_ELEVATION_DECODER, Color } from "@navara/three";
import {
  DefaultPlugin,
  type DefaultLayerDescriptions,
} from "@navara/three_default_plugin";
import { Vector3 } from "three";

import { showAttributions } from "../../helpers/attributions";
import {
  TERRAIN_DATASETS,
  TILE_DATASETS,
  VECTOR_DATASETS,
} from "../../helpers/constants";

export type LayerDescriptions = DefaultLayerDescriptions;

export const run = async (view: ThreeView<LayerDescriptions>) => {
  const plugin = new DefaultPlugin();
  view.addPlugin(plugin);
  await view.init();

  plugin.addDefaultPhotorealLayers();

  view.atmosphere.date.setHours(8);

  view.addLayer({
    type: "mesh",
    axesHelper: {
      size: 5,
    },
    scale: new Vector3().setScalar(1e9),
  });

  view.addLayer({
    type: "tiles",
    data: {
      url: TILE_DATASETS.openstreetmap.url,
    },
    rasterTile: {
      maxZoom: 23,
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
    },
  });

  view.addLayer({
    type: "mvt",
    data: {
      url: VECTOR_DATASETS.gsiExperimentalVector.url,
    },
    point: {
      size: 1000,
      scaleByDistance: false,
      color: new Color().setStyle("#ff0000"),
    },
    // text: {
    //   color: new Color().setStyle("#ff00ff"),
    //   size: 30,
    //   scaleByDistance: true,
    //   text: "MVT",
    // },
    polyline: {
      show: true,
      color: new Color().setStyle("#3d1623"),
      width: 2,
      height: 1,
      clampToGround: true,
    },
    polygon: {
      color: new Color().setStyle("#00aaff"),
      height: 10,
      extrudedHeight: 0,
      clampToGround: true,
      wireframe: false,
    },
    vectorTile: {
      maxZoom: 16,
    },
  });

  showAttributions([
    TERRAIN_DATASETS.gsi,
    TILE_DATASETS.openstreetmap,
    VECTOR_DATASETS.gsiExperimentalVector,
  ]);
};
