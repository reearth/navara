import ThreeView, {
  TERRARIUM_ELEVATION_DECODER,
  type LayerDescription,
} from "@navara/three";
import { ToneMappingMode } from "@navara/three_default_layers";
import {
  DefaultPlugin,
  type DefaultDeclarations,
} from "@navara/three_default_plugin";
import { Pane } from "tweakpane";

import { showAttributions } from "../../../helpers/attributions";
import { TERRAIN_DATASETS, TILE_DATASETS } from "../../../helpers/constants";
import { addCameraControl, addDateControl } from "../../../helpers/control";

export type CustomDeclarations = DefaultDeclarations;

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

  // Base raster tile layer (OpenStreetMap)
  view.addLayer({
    type: "tiles",
    data: {
      url: TILE_DATASETS.openstreetmap.url,
    },
    rasterTile: {
      maxZoom: 23,
    },
  });

  // Hillshade layer without terrain (flat projection)
  // The hillshade will be rendered on top of the flat base map
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
    lng: 174.0869520541,
    lat: -39.2936427656,
    height: 17879.48,
    heading: 295,
    pitch: -90,
    roll: 0,
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
