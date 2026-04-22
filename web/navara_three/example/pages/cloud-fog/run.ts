import ThreeView, {
  Color,
  JAPAN_GSI_ELEVATION_DECODER,
  EffectHandle,
} from "@navara/three";
import type { CloudsEffectDesc } from "@navara/three_default_layers";
import {
  DefaultPlugin,
  type DefaultDeclarations,
} from "@navara/three_default_plugin";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import {
  TERRAIN_DATASETS,
  TILE_DATASETS,
  TILES_3D_DATASETS,
} from "../../helpers/constants";
import { addCameraControl, addDateControl } from "../../helpers/control";
import { addFieldsToFolder, type FolderFields } from "../../helpers/panel";

export type CustomDeclarations = DefaultDeclarations;

export const run = async (view: ThreeView<CustomDeclarations>) => {
  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  await view.init();

  const defaultEffects = defaultPlugin.addDefaultPhotorealScene();

  // Add clouds effect descriptor explicitly
  const cloudsLayer = view.addEffect<CloudsEffectDesc>({
    clouds: {},
  });

  view.addLayer({
    type: "tiles",
    data: {
      url: TILE_DATASETS.gsiSeamlessphoto.url,
    },
    rasterTile: {},
  });

  view.addLayer({
    type: "terrain",
    data: {
      url: TERRAIN_DATASETS.gsi.url,
    },
    rasterTerrain: {
      maxZoom: 15,
      minZoom: 5,
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    },
  });

  view.addLayer({
    type: "cesium3dtiles",
    data: {
      url: TILES_3D_DATASETS.plateauChiyoda.url,
    },
    model: {
      show: true,
      color: new Color().setStyle("#ffffff"),
      metalness: 0,
      roughness: 1,
    },
  });

  view.addLayer({
    type: "cesium3dtiles",
    data: {
      url: TILES_3D_DATASETS.plateauChuo.url,
    },
    model: {
      show: true,
      color: new Color().setStyle("#ffffff"),
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

  showAttributions([
    TERRAIN_DATASETS.gsi,
    TILE_DATASETS.gsiSeamlessphoto,
    TILES_3D_DATASETS.plateauChiyoda,
    TILES_3D_DATASETS.plateauChuo,
  ]);
};

const addCloudFogControl = (
  pane: Pane,
  cloudsLayerHandle: EffectHandle<CloudsEffectDesc>,
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
