import ThreeView, { Color, JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import { ToneMappingMode } from "@navara/three_default_layers";
import {
  DefaultPlugin,
  type DefaultLayerDescriptions,
} from "@navara/three_default_plugin";
import { SphericalHarmonics3 } from "three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import { TERRAIN_DATASETS, VECTOR_DATASETS } from "../../helpers/constants";
import { addCameraControl } from "../../helpers/control";
import { SH_COEFFICIENTS } from "../../helpers/sh";

export type LayerDescriptions = DefaultLayerDescriptions;

export const run = async (view: ThreeView<LayerDescriptions>) => {
  view.addPlugin(new DefaultPlugin());

  await view.init();

  view.addLayer({ type: "light", ambient: {} });

  view.toneMappingExposure = 3;

  view.addLayer({
    type: "effect",
    toneMapping: {
      mode: ToneMappingMode.REINHARD2,
    },
  });

  view.addLayer({
    type: "effect",
    smaa: {},
  });

  view.addLayer({
    type: "light",
    lightProbe: {
      sh: new SphericalHarmonics3().set(SH_COEFFICIENTS.white),
      intensity: 1,
    },
  });

  view.setCamera({
    lng: 138.89,
    lat: 34.32,
    height: 54081,
    heading: 354,
    pitch: -28,
    roll: 0,
  });

  // Add terrain layer for 3D surface
  view.addLayer({
    type: "terrain",
    data: {
      url: TERRAIN_DATASETS.gsi.url,
    },
    rasterTerrain: {
      maxZoom: 15,
      minZoom: 5,
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
      castShadow: false,
      receiveShadow: false,
    },
  });

  // view.addLayer({
  //   type: "terrain",
  //   ellipsoid: {},
  // });

  view.addLayer({
    type: "mvt",
    data: {
      url: VECTOR_DATASETS.gsiExperimentalVector.url,
    },
    polygon: {
      color: new Color().setStyle("#00aaff"),
      height: 10,
      extrudedHeight: 0,
      clampToGround: true,
      wireframe: false,
    },
    vectorTile: {
      maxZoom: 16,
      layers: ["waterarea"],
    },
  });
  view.addLayer({
    type: "mvt",
    data: {
      url: VECTOR_DATASETS.gsiExperimentalVector.url,
    },
    polygon: {
      color: new Color().setStyle("#555555"),
      height: 10,
      extrudedHeight: 0,
      clampToGround: true,
      wireframe: false,
    },
    vectorTile: {
      maxZoom: 16,
      layers: ["building"],
    },
  });
  view.addLayer({
    type: "mvt",
    data: {
      url: VECTOR_DATASETS.gsiExperimentalVector.url,
    },
    polyline: {
      show: true,
      color: new Color().setStyle("#c320d8"),
      width: 2,
      height: 1,
      clampToGround: true,
    },
    vectorTile: {
      maxZoom: 16,
      layers: ["contour"],
    },
  });
  view.addLayer({
    type: "mvt",
    data: {
      url: VECTOR_DATASETS.gsiExperimentalVector.url,
    },
    polyline: {
      show: true,
      color: new Color().setStyle("#777777"),
      width: 3,
      height: 1,
      clampToGround: true,
    },
    vectorTile: {
      maxZoom: 16,
      layers: ["road"],
    },
  });

  view.addLayer({
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: {
        coordinates: [
          [
            [138.66861922558115, 35.46838056308519],
            [138.6559918549957, 35.29164005065681],
            [138.81174182884172, 35.279838616806046],
            [138.8071009152797, 35.436389815907134],
            [138.66861922558115, 35.46838056308519],
          ],
          [
            [138.75848857087954, 35.327942674501244],
            [138.75848857087954, 35.30705741002396],
            [138.7099676960035, 35.30705741002396],
            [138.75848857087954, 35.327942674501244],
          ],
          [
            [138.69753667745107, 35.422992283445495],
            [138.720671486169, 35.422992283445495],
            [138.720671486169, 35.400362713394486],
            [138.69753667745107, 35.400362713394486],
            [138.69753667745107, 35.422992283445495],
          ],
          [
            [138.7586738667644, 35.412062776959175],
            [138.78255935881282, 35.412062776959175],
            [138.78255935881282, 35.39057755353295],
            [138.7586738667644, 35.39057755353295],
            [138.7586738667644, 35.412062776959175],
          ],
          [
            [138.7211460206937, 35.370481559123604],
            [138.7388966476277, 35.370481559123604],
            [138.7388966476277, 35.35731998796588],
            [138.7211460206937, 35.35731998796588],
            [138.7211460206937, 35.370481559123604],
          ],
        ],
        type: "Polygon",
      },
    },
    polygon: {
      color: new Color().setStyle("#00aaff"),
      clampToGround: true,
    },
  });

  // Create control panel
  const pane = new Pane();
  addCameraControl(view, pane);
  showAttributions([
    TERRAIN_DATASETS.gsi,
    VECTOR_DATASETS.gsiExperimentalVector,
  ]);
};
