import ThreeView, { TERRARIUM_ELEVATION_DECODER } from "@navaramap/three";
import { ToneMappingMode } from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { Pane } from "tweakpane";

import { TERRAIN_DATASETS, TILE_DATASETS } from "../../helpers/constants";
import { addDateControl } from "../../helpers/control";

export type CustomDescriptions = DefaultDescriptions;

export const run = async (view: ThreeView<CustomDescriptions>) => {
  view.addPlugin(new DefaultPlugin());

  const attribution = view.attribution;

  await view.init();

  view.toneMappingExposure = 3;
  view.addEffect({
    toneMapping: {
      mode: ToneMappingMode.NEUTRAL,
    },
  });

  view.addEffect({
    smaa: {},
  });

  view.addLight({
    sun: {
      intensity: 1,
    },
  });
  view.addMesh({
    sky: {},
  });

  view.addLight({
    ambient: {
      intensity: 0.1,
    },
  });

  const osmSource = view.addSource({
    type: "raster-tile",
    url: TILE_DATASETS.openstreetmap.url,
    maxZoom: 23,
  });
  view.addLayer({
    type: "raster",
    source: osmSource,
  });

  const mapterhornDem = view.addSource({
    type: "raster-dem",
    url: TERRAIN_DATASETS.mapterhorn.url,
    maxZoom: 17,
    minZoom: 5,
    elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
    tileSize: 512,
  });
  view.addLayer({
    type: "raster",
    source: mapterhornDem,
    hillshade: {
      exaggeration: 1.0,
    },
  });

  view.addLayer({
    type: "terrain",
    source: mapterhornDem,
    terrain: {
      castShadow: true,
      receiveShadow: true,
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

  attribution?.add([TERRAIN_DATASETS.mapterhorn, TILE_DATASETS.openstreetmap]);
};
