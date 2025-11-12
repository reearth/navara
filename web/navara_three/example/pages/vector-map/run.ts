import ThreeView, { JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import { Vector3 } from "three";

import { showAttributions } from "../../helpers/attributions";
import {
  TERRAIN_DATASETS,
  TILE_DATASETS,
  VECTOR_DATASETS,
} from "../../helpers/constants";

export const run = async (view: ThreeView) => {
  await view.init();

  view.addDefaultAtmosphereLayers();

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
    raster_tile: {
      max_zoom: 23,
    },
  });

  view.addLayer({
    type: "terrain",
    data: {
      url: TERRAIN_DATASETS.gsi.url,
    },
    raster_terrain: {
      max_zoom: 15,
      min_zoom: 5,
      elevation_decoder: JAPAN_GSI_ELEVATION_DECODER(),
    },
  });

  view.addLayer({
    type: "mvt",
    data: {
      url: VECTOR_DATASETS.gsiExperimentalVector.url,
    },
    point: {
      size: 1000,
      scale_by_distance: false,
      color: 0xff0000,
    },
    // text: {
    //   color: 0xff00ff,
    //   size: 30,
    //   scale_by_distance: true,
    //   text: "MVT",
    // },
    polyline: {
      show: true,
      color: 0x3d1623,
      width: 2,
      height: 1,
      clamp_to_ground: true,
    },
    polygon: {
      color: 0x00aaff,
      height: 10,
      extruded_height: 0,
      clamp_to_ground: true,
      wireframe: false,
    },
    vector_tile: {
      max_zoom: 16,
    },
  });

  showAttributions([
    TERRAIN_DATASETS.gsi,
    TILE_DATASETS.openstreetmap,
    VECTOR_DATASETS.gsiExperimentalVector,
  ]);
};
