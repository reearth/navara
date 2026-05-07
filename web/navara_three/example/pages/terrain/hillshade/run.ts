import ThreeView, {
  TERRARIUM_ELEVATION_DECODER,
  type LayerDescription,
} from "@navara/three";
import { ToneMappingMode } from "@navara/three_default_descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";
import { Pane } from "tweakpane";

import { showAttributions } from "../../../helpers/attributions";
import { TERRAIN_DATASETS, TILE_DATASETS } from "../../../helpers/constants";
import { addCameraControl, addDateControl } from "../../../helpers/control";

export type CustomDeclarations = DefaultDescriptions;

export const run = async (view: ThreeView<CustomDeclarations>) => {
  view.addPlugin(new DefaultPlugin());
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

  view.addLayer({
    type: "tiles",
    data: {
      url: TILE_DATASETS.openstreetmap.url,
    },
    rasterTile: {
      maxZoom: 23,
    },
  });

  // Add terrain layer for 3D surface
  view.addLayer({
    type: "terrain",
    data: {
      url: TERRAIN_DATASETS.mapterhorn.url,
    },
    rasterTerrain: {
      maxZoom: 15,
      minZoom: 5,
      elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
      tileSize: 512,
      castShadow: false,
      receiveShadow: false,
    },
  });

  const layerDef: LayerDescription = {
    type: "tiles",
    data: {
      url: TERRAIN_DATASETS.mapterhorn.url,
    },
    rasterTile: {
      maxZoom: 17,
      minZoom: 5,
    },
    hillshade: {
      elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
      exaggeration: 0.5,
    },
  };

  // Add hillshade layer
  const hillshadeLayer = view.addLayer(layerDef);

  view.setCamera({
    lng: 173.8798307478,
    lat: -39.4173953796,
    height: 5562.8,
    heading: 48.2357314422,
    pitch: -17.7300470005,
    roll: 360.0,
  });

  // Create control panel
  const pane = new Pane();
  const date = new Date();
  date.setUTCHours(20);

  addDateControl(view, pane, date);
  addCameraControl(view, pane);
  showAttributions([TERRAIN_DATASETS.mapterhorn, TILE_DATASETS.openstreetmap]);

  const params = {
    exaggeration: 0.5,
  };

  const changeFunc = () => {
    if (!layerDef.hillshade || !hillshadeLayer) {
      return;
    }
    layerDef.hillshade.exaggeration = params.exaggeration;
    view.updateLayerById(hillshadeLayer.id, layerDef);
  };

  const folder = pane.addFolder({
    title: "Hillshade Exaggeration",
  });

  folder
    .addBinding(params, "exaggeration", {
      min: 0.1,
      max: 5.0,
      step: 0.1,
    })
    .on("change", changeFunc);
};
