import ThreeView, {
  JAPAN_GSI_ELEVATION_DECODER,
  Layer,
  LayerHandle,
  SunLightLayer,
  type Cesium3dTilesLayer,
  type ShadowMode,
} from "@navara/three";
import { Pane } from "tweakpane";

import { TERRAIN_URLS, TILE_URLS } from "../../helpers/constants";
import { addCameraControl, addDateControl } from "../../helpers/control";
import { addFieldsToFolder, type FolderFields } from "../../helpers/panel";

export async function run() {
  const view = new ThreeView({
    shadow: true,
  });

  await view.init();

  // Add atmosphere layers
  const defaultLayers = view.addDefaultAtmosphereLayers();
  view.addDefaultEffectLayers();

  view.toneMappingExposure = 10;

  // Add terrain layer
  view.addLayer({
    type: "terrain",
    data: {
      url: TERRAIN_URLS.gsi,
    },
    raster_terrain: {
      max_zoom: 15,
      min_zoom: 6,
      elevation_decoder: JAPAN_GSI_ELEVATION_DECODER(),
      cast_shadow: true,
      receive_shadow: true,
    },
  });

  // Add tile layer
  view.addLayer({
    type: "tiles",
    data: { url: TILE_URLS.gsiSeamlessphoto },
    raster_tile: {
      color: 0xffffff,
      max_zoom: 18,
      opacity: 1,
    },
  });

  const pane = new Pane();

  addCameraControl(view, pane);
  addDateControl(view, pane);
  addViewShadowControl(view, defaultLayers.sun, pane);
  addBuildingModelControl(view, pane);
}

const addViewShadowControl = (
  view: ThreeView,
  sun: LayerHandle<SunLightLayer>,
  pane: Pane,
) => {
  const PARAMS = {
    shadow: true,
    shadowCascadeCount: 4,
    shadowFade: true,
    shadowMapSize: 2048,
    shadowFar: 5e4,
    shadowMode: "practical",
    shadowLambda: 0.8,
    shadowMargin: 5000,
    shadowIntensity: 1,
    shadowBias: 0.0001,
    shadowNormalBias: 0,
    shadowMapViewers: false,
  };

  sun.update({
    sun: {
      castShadow: true,
    },
  });

  const fields: FolderFields<typeof PARAMS> = [
    {
      name: "shadow",
      onChange: (v) => {
        sun.update({
          sun: {
            castShadow: v.value,
          },
        });
      },
    },
    {
      name: "shadowCascadeCount",
      params: {
        min: 0,
        max: 6,
        step: 1,
      },
      onChange: (v) => {
        sun.update({
          sun: {
            shadowCascadeCount: v.value,
          },
        });
      },
    },
    {
      name: "shadowFade",
      onChange: (v) => {
        sun.update({
          sun: {
            shadowFade: v.value,
          },
        });
      },
    },
    {
      name: "shadowMapSize",
      params: {
        options: Object.fromEntries(
          [1024, 2048, 4096, 8192].map((k) => [k, k]),
        ),
      },
      onChange: (v) => {
        sun.update({
          sun: {
            shadowMapSize: v.value,
          },
        });
      },
    },
    {
      name: "shadowFar",
      params: {
        min: 0,
      },
      onChange: (v) => {
        sun.update({
          sun: {
            shadowFar: v.value,
          },
        });
      },
    },
    {
      name: "shadowMode",
      params: {
        options: Object.fromEntries(
          (["logarithmic", "practical", "uniform"] as ShadowMode[]).map((k) => [
            k,
            k,
          ]),
        ),
      },
      onChange: (v) => {
        sun.update({
          sun: {
            shadowMode: v.value as ShadowMode,
          },
        });
      },
    },
    {
      name: "shadowLambda",
      params: {
        min: 0,
        max: 1,
      },
      onChange: (v) => {
        sun.update({
          sun: {
            shadowLambda: v.value,
          },
        });
      },
    },
    {
      name: "shadowMargin",
      params: {
        min: 0,
      },
      onChange: (v) => {
        sun.update({
          sun: {
            shadowMargin: v.value,
          },
        });
      },
    },
    {
      name: "shadowIntensity",
      params: {
        min: 0,
        max: 1,
      },
      onChange: (v) => {
        sun.update({
          sun: {
            shadowIntensity: v.value,
          },
        });
      },
    },
    {
      name: "shadowBias",
      params: {
        min: 0,
        step: 0.0001,
        max: 0.001,
      },
      onChange: (v) => {
        sun.update({
          sun: {
            shadowBias: v.value,
          },
        });
      },
    },
    {
      name: "shadowNormalBias",
      params: {},
      onChange: (v) => {
        sun.update({
          sun: {
            shadowNormalBias: v.value,
          },
        });
      },
    },
    {
      name: "shadowMapViewers",
      params: {},
      onChange: (v) => {
        view.shadowMapViewersEnabled = v.value;
      },
    },
  ];
  addFieldsToFolder(
    pane.addFolder({ title: "Sun light shadow" }),
    PARAMS,
    fields,
  );
};

const addBuildingModelControl = (view: ThreeView, pane: Pane) => {
  const buildingLayerDescriptions: Cesium3dTilesLayer[] = [
    {
      type: "cesium3dtiles",
      data: {
        url: "https://assets.cms.plateau.reearth.io/assets/db/070026-aa27-431b-8d53-7cc6b03244f8/13101_chiyoda-ku_pref_2023_citygml_1_op_bldg_3dtiles_13101_chiyoda-ku_lod2_no_texture/tileset.json",
      },
      model: {
        show: true,
        cast_shadow: true,
        receive_shadow: true,
        color: 0xffffff,
        metalness: 0,
        roughness: 1,
      },
    },
    {
      type: "cesium3dtiles",
      data: {
        url: "https://assets.cms.plateau.reearth.io/assets/4c/f2436a-e2be-40e2-83da-f1781f36e30b/13102_chuo-ku_pref_2023_citygml_1_op_bldg_3dtiles_13102_chuo-ku_lod2_no_texture/tileset.json",
      },
      model: {
        show: true,
        cast_shadow: true,
        receive_shadow: true,
        color: 0xffffff,
        metalness: 0,
        roughness: 1,
      },
    },
  ];

  const buildingLayers: Layer[] = [];
  for (const desc of buildingLayerDescriptions) {
    buildingLayers.push(view.addLayer(desc));
  }

  const PARAMS = {
    cast_shadow: true,
    receive_shadow: true,
  };

  const fields: FolderFields<typeof PARAMS> = [
    {
      name: "cast_shadow",
      onChange: (v) => {
        buildingLayers.forEach((l, idx) => {
          l.update({
            ...buildingLayerDescriptions[idx],
            model: {
              ...buildingLayerDescriptions[idx].model,
              cast_shadow: v.value,
            },
          });
        });
      },
    },
    {
      name: "receive_shadow",
      onChange: (v) => {
        buildingLayers.forEach((l, idx) => {
          l.update({
            ...buildingLayerDescriptions[idx],
            model: {
              ...buildingLayerDescriptions[idx].model,
              receive_shadow: v.value,
            },
          });
        });
      },
    },
  ];
  addFieldsToFolder(
    pane.addFolder({ title: "Building shadow" }),
    PARAMS,
    fields,
  );
};
