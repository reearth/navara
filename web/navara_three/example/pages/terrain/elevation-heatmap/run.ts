import ThreeView, {
  TERRARIUM_ELEVATION_DECODER,
  Color,
  type LayerDescription,
} from "@navara/three";
import { ToneMappingMode } from "@navara/three_default_layers";
import {
  DefaultPlugin,
  type DefaultDeclarations,
} from "@navara/three_default_plugin";
import { SphericalHarmonics3 } from "three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../../helpers/attributions";
import {
  PLATEAU_COLOR_MAP,
  TURBO_COLOR_MAP,
  PLASMA_COLORMAP,
  YlGnBu_COLOR_MAP,
} from "../../../helpers/colors";
import { TERRAIN_DATASETS } from "../../../helpers/constants";
import { addCameraControl, addDateControl } from "../../../helpers/control";
import { SH_COEFFICIENTS } from "../../../helpers/sh";

export type CustomDeclarations = DefaultDeclarations;

export const run = async (view: ThreeView<CustomDeclarations>) => {
  view.addPlugin(new DefaultPlugin());

  await view.init();

  view.addLight({ ambient: {} });

  view.toneMappingExposure = 3;

  view.addEffect({
    toneMapping: {
      mode: ToneMappingMode.REINHARD2,
    },
  });

  view.addLight({
    lightProbe: {
      sh: new SphericalHarmonics3().set(SH_COEFFICIENTS.white),
      intensity: 1,
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

  view.addLayer({
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
    },
  });

  // Set the elevation colormap on the globe
  view.globe.elevationColormap = PLATEAU_COLOR_MAP;

  const layerDef: LayerDescription = {
    type: "tiles",
    data: {
      url: TERRAIN_DATASETS.mapterhorn.url,
    },
    rasterTile: {
      maxZoom: 17,
    },
    elevationHeatmap: {
      maxHeight: 3000,
      minHeight: 0,
      elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
      logarithmic: true,
      logBoundary: 1000,
    },
  };

  // Add elevation heatmap as a raster tile layer
  // This will use the terrain DEM data and apply color mapping
  const layerInst = view.addLayer(layerDef);

  view.setCamera({
    lng: 138.5,
    lat: 34,
    height: 100000,
    heading: 0,
    pitch: -30,
    roll: 0,
  });

  // Create control panel
  const pane = new Pane();
  addDateControl(view, pane);
  addCameraControl(view, pane);
  showAttributions([TERRAIN_DATASETS.mapterhorn]);

  const params = {
    color_map: "plateau",
    max_height: 3000,
    min_height: 0,
    logarithmic: true,
    log_boundary: 1000,
  };

  view.globe.elevationColormap = PLATEAU_COLOR_MAP;
  view.globe.color = new Color().setStyle("#9481ad");

  const changeFunc = () => {
    if (!layerDef.elevationHeatmap) {
      return;
    }
    layerDef.elevationHeatmap.maxHeight = params.max_height;
    layerDef.elevationHeatmap.minHeight = params.min_height;
    layerDef.elevationHeatmap.logarithmic = params.logarithmic;
    layerDef.elevationHeatmap.logBoundary = params.log_boundary;

    if (params.color_map === "plateau") {
      view.globe.elevationColormap = PLATEAU_COLOR_MAP;
      view.globe.color = new Color().setStyle("#9481ad");
    } else if (params.color_map === "turbo") {
      view.globe.elevationColormap = TURBO_COLOR_MAP;
      view.globe.color = new Color().setStyle("#784986");
    } else if (params.color_map === "plasma") {
      view.globe.elevationColormap = PLASMA_COLORMAP;
      view.globe.color = new Color().setStyle("#7a4a91");
    } else if (params.color_map === "YlGnBu") {
      view.globe.elevationColormap = YlGnBu_COLOR_MAP;
      view.globe.color = new Color().setStyle("#506b73");
    }
    view.updateLayerById(layerInst.id, layerDef);
  };

  const folder = pane.addFolder({
    title: "Elevation Heatmap",
  });

  folder
    .addBinding(params, "color_map", {
      options: {
        plateau: "plateau",
        turbo: "turbo",
        plasma: "plasma",
        YlGnBu: "YlGnBu",
      },
    })
    .on("change", changeFunc);
  folder.addBinding(params, "max_height").on("change", changeFunc);
  folder.addBinding(params, "min_height").on("change", changeFunc);
  folder.addBinding(params, "logarithmic").on("change", changeFunc);
  folder
    .addBinding(params, "log_boundary", { min: 0 })
    .on("change", changeFunc);
};
