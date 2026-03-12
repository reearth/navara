import ThreeView, { TERRARIUM_ELEVATION_DECODER } from "@navara/three";
import { ToneMappingMode } from "@navara/three_default_layers";
import {
  DefaultPlugin,
  type DefaultLayerDescriptions,
} from "@navara/three_default_plugin";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import { TERRAIN_DATASETS, TILE_DATASETS } from "../../helpers/constants";
import { addDateControl } from "../../helpers/control";

export type LayerDescriptions = DefaultLayerDescriptions;

export const run = async (view: ThreeView<LayerDescriptions>) => {
  view.addPlugin(new DefaultPlugin());

  await view.init();

  view.toneMappingExposure = 3;
  view.addLayer({
    type: "effect",
    toneMapping: {
      mode: ToneMappingMode.NEUTRAL,
    },
  });

  view.addLayer({
    type: "effect",
    smaa: {},
  });

  view.addLayer({
    type: "light",
    sun: {
      intensity: 1,
    },
  });
  view.addLayer({
    type: "mesh",
    sky: {},
  });

  view.addLayer({
    type: "light",
    ambient: {
      intensity: 0.1,
    },
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
    type: "tiles",
    data: { url: TERRAIN_DATASETS.mapterhorn.url },
    rasterTile: {
      maxZoom: 15,
      minZoom: 5,
    },
    hillshade: {
      elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
    },
  });

  view.addLayer({
    type: "terrain",
    data: {
      url: TERRAIN_DATASETS.mapterhorn.url,
    },
    rasterTerrain: {
      maxZoom: 15,
      minZoom: 5,
      elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
      castShadow: true,
      receiveShadow: true,
      tileSize: 512,
    },
  });

  view.setCamera({
    lng: 173.8798307478,
    lat: -39.4173953796,
    height: 5562.8,
    heading: 48.2357314422,
    pitch: -17.7300470005,
    roll: 360.0,
  });

  const pane = new Pane();

  const date = new Date();
  date.setUTCHours(20);

  addDateControl(view, pane, date);

  showAttributions([TERRAIN_DATASETS.mapterhorn, TILE_DATASETS.openstreetmap]);
};
