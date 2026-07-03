import ThreeView, { Color, JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import { ToneMappingMode } from "@navara/three_default_descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";
import { AttributionPlugin } from "@navara/three_plugins";
import { SphericalHarmonics3 } from "three";
import { Pane } from "tweakpane";

import { datasetToSource } from "../../helpers/attribution-source";
import { TERRAIN_DATASETS, VECTOR_DATASETS } from "../../helpers/constants";
import { addCameraControl } from "../../helpers/control";
import { SH_COEFFICIENTS } from "../../helpers/sh";

export type CustomDescriptions = DefaultDescriptions;

export const run = async (view: ThreeView<CustomDescriptions>) => {
  view.addPlugin(new DefaultPlugin());

  const attribution = new AttributionPlugin();
  view.addPlugin(attribution);

  await view.init();

  view.addLight({ ambient: {} });

  view.toneMappingExposure = 3;

  view.addEffect({
    toneMapping: {
      mode: ToneMappingMode.REINHARD2,
    },
  });

  view.addEffect({
    smaa: {},
  });

  view.addLight({
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

  // GSI DEM as a raster-dem source, shared by the terrain and the hillshade.
  const dem = view.addSource({
    type: "raster-dem",
    url: TERRAIN_DATASETS.gsi.url,
    elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    maxZoom: 15,
    minZoom: 5,
  });

  // Add terrain layer for 3D surface
  view.addLayer({
    type: "terrain",
    source: dem,
    terrain: { castShadow: false, receiveShadow: false },
  });

  view.addLayer({
    type: "raster",
    source: dem,
    hillshade: {},
  });

  // const ellipsoid = view.addSource({ type: "ellipsoid" });
  // view.addLayer({ type: "terrain", source: ellipsoid });

  // A single vector-tile source shared by multiple vector layers; each layer
  // renders a different source layer of the same tileset.
  const vectorTiles = view.addSource({
    type: "vector-tile",
    url: VECTOR_DATASETS.gsiExperimentalVector.url,
    maxZoom: 16,
  });

  view.addLayer({
    type: "vector",
    source: vectorTiles,
    sourceLayers: ["waterarea"],
    polygon: {
      color: new Color().setStyle("#00aaff"),
      height: 10,
      extrudedHeight: 0,
      clampToGround: true,
      wireframe: false,
    },
  });
  view.addLayer({
    type: "vector",
    source: vectorTiles,
    sourceLayers: ["building"],
    polygon: {
      color: new Color().setStyle("#555555"),
      height: 10,
      extrudedHeight: 0,
      clampToGround: true,
      wireframe: false,
    },
  });
  view.addLayer({
    type: "vector",
    source: vectorTiles,
    sourceLayers: ["contour"],
    polyline: {
      show: true,
      color: new Color().setStyle("#c320d8"),
      width: 2,
      height: 1,
      clampToGround: true,
    },
  });
  view.addLayer({
    type: "vector",
    source: vectorTiles,
    sourceLayers: ["road"],
    polyline: {
      show: true,
      color: new Color().setStyle("#777777"),
      width: 3,
      height: 1,
      clampToGround: true,
    },
  });

  const geojsonSource = view.addSource({
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
  });
  view.addLayer({
    type: "vector",
    source: geojsonSource,
    polygon: {
      color: new Color().setStyle("#00aaff"),
      clampToGround: true,
    },
  });

  // Create control panel
  const pane = new Pane();
  addCameraControl(view, pane);
  attribution.show([
    datasetToSource(TERRAIN_DATASETS.gsi),
    datasetToSource(VECTOR_DATASETS.gsiExperimentalVector),
  ]);
};
