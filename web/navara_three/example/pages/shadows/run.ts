import ThreeView, {
  Color,
  JAPAN_GSI_ELEVATION_DECODER,
  Layer,
  LayerHandle,
  SunLightLayer,
  type Cesium3dTilesLayer,
  type ShadowMode,
} from "@navara/three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import {
  TERRAIN_DATASETS,
  TILE_DATASETS,
  TILES_3D_DATASETS,
} from "../../helpers/constants";
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
      url: TERRAIN_DATASETS.gsi.url,
    },
    rasterTerrain: {
      maxZoom: 15,
      minZoom: 6,
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
      castShadow: true,
      receiveShadow: true,
    },
  });

  // Add tile layer
  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.gsiSeamlessphoto.url },
    rasterTile: {
      color: new Color().setStyle("#ffffff"),
      maxZoom: 18,
      opacity: 1,
    },
  });

  const pane = new Pane();

  addCameraControl(view, pane);
  addDateControl(view, pane);
  addViewShadowControl(view, defaultLayers.sun, pane);
  addBuildingModelControl(view, pane);

  showAttributions([
    TERRAIN_DATASETS.gsi,
    TILE_DATASETS.gsiSeamlessphoto,
    TILES_3D_DATASETS.plateauChiyoda,
    TILES_3D_DATASETS.plateauChuo,
  ]);
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
        url: TILES_3D_DATASETS.plateauChiyoda.url,
      },
      model: {
        show: true,
        castShadow: true,
        receiveShadow: true,
        color: new Color().setStyle("#ffffff"),
        metalness: 0,
        roughness: 1,
      },
    },
    {
      type: "cesium3dtiles",
      data: {
        url: TILES_3D_DATASETS.plateauChuo.url,
      },
      model: {
        show: true,
        castShadow: true,
        receiveShadow: true,
        color: new Color().setStyle("#ffffff"),
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
    castShadow: true,
    receiveShadow: true,
  };

  const fields: FolderFields<typeof PARAMS> = [
    {
      name: "castShadow",
      onChange: (v) => {
        buildingLayers.forEach((l, idx) => {
          l.update({
            ...buildingLayerDescriptions[idx],
            model: {
              ...buildingLayerDescriptions[idx].model,
              castShadow: v.value,
            },
          });
        });
      },
    },
    {
      name: "receiveShadow",
      onChange: (v) => {
        buildingLayers.forEach((l, idx) => {
          l.update({
            ...buildingLayerDescriptions[idx],
            model: {
              ...buildingLayerDescriptions[idx].model,
              receiveShadow: v.value,
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
