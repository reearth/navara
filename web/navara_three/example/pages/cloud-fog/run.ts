import ThreeView, { JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import invariant from "tiny-invariant";
import { Pane } from "tweakpane";

import { TERRAIN_URLS, TILE_URLS } from "../../helpers/constants";
import { addCameraControl, addDateControl } from "../../helpers/control";
import { addFieldsToFolder, type FolderFields } from "../../helpers/panel";

export const run = async (view: ThreeView) => {
  await view.init();

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

  view.toneMappingEffect.enabled = true;
  view.toneMappingExposure = 10;
  view.atmosphere.clouds = true;
  view.atmosphere.irradiance = true;
  view.atmosphere.cloudsShadow = true;

  const pane = new Pane({
    title: "Parameters",
    expanded: true,
  });
  pane.element.style.maxHeight = "98vh";
  pane.element.style.overflow = "scroll";

  addCameraControl(view, pane);
  addDateControl(view, pane);
  addCloudFogControl(view, pane);
};

const addCloudFogControl = (view: ThreeView, pane: Pane) => {
  invariant(view.atmosphere.cloudsEffect);

  const PARAMS = {
    height: 2000,
    density: 0.01,
  };

  view.atmosphere.cloudsEffect.coverage = 0.3;
  view.atmosphere.cloudsEffect.cloudLayers[3].altitude = 0;
  view.atmosphere.cloudsEffect.cloudLayers[3].height = PARAMS.height;
  view.atmosphere.cloudsEffect.cloudLayers[3].densityScale = 0.05;
  view.atmosphere.cloudsEffect.cloudLayers[3].shapeAmount = 0.2;
  view.atmosphere.cloudsEffect.cloudLayers[3].shapeDetailAmount = 0;
  view.atmosphere.cloudsEffect.cloudLayers[3].shapeAlteringBias = 0.5;
  view.atmosphere.cloudsEffect.cloudLayers[3].coverageFilterWidth = 1;
  view.atmosphere.cloudsEffect.cloudLayers[3].expTerm = 0;
  view.atmosphere.cloudsEffect.cloudLayers[3].exponent = 0;
  view.atmosphere.cloudsEffect.cloudLayers[3].constantTerm = PARAMS.density;
  view.atmosphere.cloudsEffect.cloudLayers[3].linearTerm = 0;

  const folderFields: FolderFields<typeof PARAMS> = [
    {
      name: "height",
      params: {
        step: 100,
      },
      onChange: (v) => {
        invariant(view.atmosphere.cloudsEffect);
        view.atmosphere.cloudsEffect.cloudLayers[3].height = v.value;
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
        invariant(view.atmosphere.cloudsEffect);
        view.atmosphere.cloudsEffect.cloudLayers[3].constantTerm = v.value;
      },
    },
  ];

  const folder = pane.addFolder({
    title: "Cloud fog",
  });

  addFieldsToFolder(folder, PARAMS, folderFields);
};
