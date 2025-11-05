import ThreeView, {
  JAPAN_GSI_ELEVATION_DECODER,
  ToneMappingMode,
  type LayerDescription,
} from "@navara/three";
import { SphericalHarmonics3 } from "three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import { PLATEAU_COLOR_MAP, TURBO_COLOR_MAP } from "../../helpers/colors";
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

  // Set camera to focus on Mt. Fuji area
  view.setCamera({
    lng: 138.7306518555,
    lat: 35.272277832,
    height: 30000,
    heading: 0,
    pitch: -70,
    roll: 0,
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
      color_map_lut: PLATEAU_COLOR_MAP.flatten(),
    },
  };

  // Add elevation heatmap as a raster tile layer
  // This will use the terrain DEM data and apply color mapping
  const layerInst = view.addLayer(layerDef);

  view.setCamera({
    lng: 138.75,
    lat: 35.13,
    height: 10000,
    heading: 0,
    pitch: -20,
    roll: 0,
  });

  // Create control panel
  const pane = new Pane();
  addDateControl(view, pane);
  addCameraControl(view, pane);
  showAttributions([TERRAIN_DATASETS.gsi]);

  const params = {
    max_height: 3000,
    min_height: 0,
    color_map: "plateau",
  };

  const changeFunc = () => {
    if (!layerDef.elevation_heatmap) {
      return;
    }
    layerDef.elevation_heatmap.max_height = params.max_height;
    layerDef.elevation_heatmap.min_height = params.min_height;

    if (params.color_map === "plateau") {
      layerDef.elevation_heatmap.color_map_lut = PLATEAU_COLOR_MAP.flatten();
    } else if (params.color_map === "turbo") {
      layerDef.elevation_heatmap.color_map_lut = TURBO_COLOR_MAP.flatten();
    }
    view.updateLayerById(layerInst.id, layerDef);
  };

  const folder = pane.addFolder({
    title: "Elevation Heatmap",
  });

  folder.addBinding(params, "max_height").on("change", changeFunc);
  folder.addBinding(params, "min_height").on("change", changeFunc);
  folder
    .addBinding(params, "color_map", {
      options: { plateau: "plateau", turbo: "turbo" },
    })
    .on("change", changeFunc);
};
