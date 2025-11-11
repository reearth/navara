import ThreeView, {
  JAPAN_GSI_ELEVATION_DECODER,
  ToneMappingMode,
  type LayerDescription,
} from "@navara/three";
import { SphericalHarmonics3 } from "three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import {
  PLATEAU_COLOR_MAP,
  TURBO_COLOR_MAP,
  PLASMA_COLORMAP,
  YlGnBu_COLOR_MAP,
} from "../../helpers/colors";
import { TERRAIN_DATASETS } from "../../helpers/constants";
import { addCameraControl, addDateControl } from "../../helpers/control";
import { SH_COEFFICIENTS } from "../../helpers/sh";

export const run = async (view: ThreeView) => {
  await view.init();

  // Add atmosphere layers
  const defaultAtmosphere = view.addDefaultAtmosphereLayers();

  defaultAtmosphere.sun.update({
    sun: {},
    visible: false,
  });

  view.toneMappingExposure = 5;

  view.addLayer({
    type: "effect",
    toneMapping: {
      mode: ToneMappingMode.REINHARD2,
    },
  });

  view.addLayer({
    type: "light",
    lightProbe: {
      sh: new SphericalHarmonics3().set(SH_COEFFICIENTS.white),
      intensity: 1,
    },
  });

  // Add terrain layer for 3D surface
  view.addLayer({
    type: "terrain",
    data: {
      url: TERRAIN_DATASETS.gsi.url,
    },
    raster_terrain: {
      max_zoom: 15,
      min_zoom: 5,
      elevation_decoder: JAPAN_GSI_ELEVATION_DECODER(),
      cast_shadow: false,
      receive_shadow: false,
    },
  });

  // Set the elevation colormap on the globe
  view.globe.elevationColormap = PLATEAU_COLOR_MAP;

  const layerDef: LayerDescription = {
    type: "tiles",
    data: {
      url: TERRAIN_DATASETS.gsi.url, // Use terrain DEM URL
    },
    raster_tile: {
      max_zoom: 15,
      min_zoom: 6,
    },
    elevation_heatmap: {
      max_height: 3000,
      min_height: 0,
      elevation_decoder: JAPAN_GSI_ELEVATION_DECODER(),
      logarithmic: true,
      log_boundary: 1000,
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
  showAttributions([TERRAIN_DATASETS.gsi]);

  const params = {
    color_map: "plateau",
    max_height: 3000,
    min_height: 0,
    logarithmic: true,
    log_boundary: 1000,
  };

  view.globe.elevationColormap = PLATEAU_COLOR_MAP;
  view.globe.color = 0x9481ad;

  const changeFunc = () => {
    if (!layerDef.elevation_heatmap) {
      return;
    }
    layerDef.elevation_heatmap.max_height = params.max_height;
    layerDef.elevation_heatmap.min_height = params.min_height;
    layerDef.elevation_heatmap.logarithmic = params.logarithmic;
    layerDef.elevation_heatmap.log_boundary = params.log_boundary;

    if (params.color_map === "plateau") {
      view.globe.elevationColormap = PLATEAU_COLOR_MAP;
      view.globe.color = 0x9481ad;
    } else if (params.color_map === "turbo") {
      view.globe.elevationColormap = TURBO_COLOR_MAP;
      view.globe.color = 0x784986;
    } else if (params.color_map === "plasma") {
      view.globe.elevationColormap = PLASMA_COLORMAP;
      view.globe.color = 0x7a4a91;
    } else if (params.color_map === "YlGnBu") {
      view.globe.elevationColormap = YlGnBu_COLOR_MAP;
      view.globe.color = 0x506b73;
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
