import ThreeView, {
  JAPAN_GSI_ELEVATION_DECODER,
  LayerHandle,
} from "@navara/three";
import { Pane } from "tweakpane";

import type { CloudsEffectLayer } from "../../../src/layers/effect";
import { TERRAIN_URLS, TILE_URLS } from "../../helpers/constants";
import { addCameraControl, addDateControl } from "../../helpers/control";
import { addFieldsToFolder, type FolderFields } from "../../helpers/panel";

export const run = async (view: ThreeView) => {
  await view.init();

  const defaultEffects = view.addDefaultEffectLayers();
  view.addDefaultAtmosphereLayers();

  // Add clouds effect layer explicitly
  const cloudsLayer = view.addLayer<CloudsEffectLayer>({
    type: "effect",
    clouds: {},
  });

  view.addLayer({
    type: "tiles",
    data: {
      url: TILE_URLS.gsiSeamlessphoto,
    },
    raster_tile: {},
  });

  view.addLayer({
    type: "terrain",
    data: {
      url: TERRAIN_URLS.gsi,
    },
    raster_terrain: {
      max_zoom: 15,
      min_zoom: 5,
      elevation_decoder: JAPAN_GSI_ELEVATION_DECODER(),
    },
  });

  view.addLayer({
    type: "cesium3dtiles",
    data: {
      url: "https://assets.cms.plateau.reearth.io/assets/db/070026-aa27-431b-8d53-7cc6b03244f8/13101_chiyoda-ku_pref_2023_citygml_1_op_bldg_3dtiles_13101_chiyoda-ku_lod2_no_texture/tileset.json",
    },
    model: {
      show: true,
      id_property: "gml_id",
      color: 0xffffff,
      metalness: 0,
      roughness: 1,
    },
  });

  view.addLayer({
    type: "cesium3dtiles",
    data: {
      url: "https://assets.cms.plateau.reearth.io/assets/4c/f2436a-e2be-40e2-83da-f1781f36e30b/13102_chuo-ku_pref_2023_citygml_1_op_bldg_3dtiles_13102_chuo-ku_lod2_no_texture/tileset.json",
    },
    model: {
      show: true,
      id_property: "gml_id",
      color: 0xffffff,
      metalness: 0,
      roughness: 1,
    },
  });

  defaultEffects.toneMapping.update({ visible: true });
  view.toneMappingExposure = 10;
  defaultEffects.aerialPerspective.update({
    aerialPerspective: {
      irradiance: true,
    },
  });
  cloudsLayer.update({ clouds: { shadows: true } });

  const pane = new Pane({
    title: "Parameters",
    expanded: true,
  });
  pane.element.style.maxHeight = "98vh";
  pane.element.style.overflow = "scroll";

  addCameraControl(view, pane);
  addDateControl(view, pane);
  addCloudFogControl(pane, cloudsLayer);
};

const addCloudFogControl = (
  pane: Pane,
  cloudsLayerHandle: LayerHandle<CloudsEffectLayer>,
) => {
  const PARAMS = {
    height: 2000,
    density: 0.01,
  };

  const cloudsLayer = cloudsLayerHandle.ref.raw;

  if (cloudsLayer) {
    cloudsLayer.coverage = 0.3;
    cloudsLayer.cloudLayers[3].altitude = 0;
    cloudsLayer.cloudLayers[3].height = PARAMS.height;
    cloudsLayer.cloudLayers[3].densityScale = 0.05;
    cloudsLayer.cloudLayers[3].shapeAmount = 0.2;
    cloudsLayer.cloudLayers[3].shapeDetailAmount = 0;
    cloudsLayer.cloudLayers[3].shapeAlteringBias = 0.5;
    cloudsLayer.cloudLayers[3].coverageFilterWidth = 1;
    cloudsLayer.cloudLayers[3].expTerm = 0;
    cloudsLayer.cloudLayers[3].exponent = 0;
    cloudsLayer.cloudLayers[3].constantTerm = PARAMS.density;
    cloudsLayer.cloudLayers[3].linearTerm = 0;
  }

  const folderFields: FolderFields<typeof PARAMS> = [
    {
      name: "height",
      params: {
        step: 100,
      },
      onChange: (v) => {
        if (cloudsLayer) {
          cloudsLayer.cloudLayers[3].height = v.value;
        }
      },
    },
    {
      name: "density",
      params: {
        min: 0,
        max: 0.1,
        step: 0.001,
      },
      onChange: (v) => {
        if (cloudsLayer) {
          cloudsLayer.cloudLayers[3].constantTerm = v.value;
        }
      },
    },
  ];

  const folder = pane.addFolder({
    title: "Cloud fog",
  });

  addFieldsToFolder(folder, PARAMS, folderFields);
};
