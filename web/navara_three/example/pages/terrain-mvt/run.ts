import ThreeView, {
  Color,
  JAPAN_GSI_ELEVATION_DECODER,
  type Layer,
} from "@navara/three";
import { ToneMappingMode } from "@navara/three_default_descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";
import { AttributionPlugin } from "@navara/three_plugins";
import { SphericalHarmonics3 } from "three";
import { Pane } from "tweakpane";

import { TERRAIN_DATASETS, VECTOR_DATASETS } from "../../helpers/constants";
import { addCameraControl } from "../../helpers/control";
import { SH_COEFFICIENTS } from "../../helpers/sh";

export type CustomDescriptions = DefaultDescriptions;

type TerrainMode = "quantizedMesh" | "raster";

type CameraState = {
  lng: number;
  lat: number;
  height: number;
  heading: number;
  pitch: number;
  roll: number;
};

const INITIAL_CAMERA: CameraState = {
  lng: 138.89,
  lat: 34.32,
  height: 54081,
  heading: 354,
  pitch: -28,
  roll: 0,
};

export const run = async () => {
  let currentMode: TerrainMode = "quantizedMesh";
  const cameraState: CameraState = { ...INITIAL_CAMERA };

  const view = new ThreeView<CustomDescriptions>({
    debug: true,
  });

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

  view.setCamera({ ...cameraState });

  // Both terrain sources are registered up front and KEPT for the page's
  // lifetime; switching only re-points the terrain layer at the other source
  // (like MapLibre's `setTerrain({ source })`) via `updateLayer` — no source
  // delete, no dispose.
  const qmSource = view.addSource({
    type: "quantized-mesh",
    url: TERRAIN_DATASETS.reearthQuantizedMesh.url,
    maxZoom: 18,
    requestVertexNormals: true,
  });
  // GSI DEM as a raster-dem source, shared by the terrain and its hillshade.
  const demSource = view.addSource({
    type: "raster-dem",
    url: TERRAIN_DATASETS.gsi.url,
    elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    maxZoom: 15,
    minZoom: 5,
  });

  const terrainLayer = view.addLayer({
    type: "terrain",
    source: qmSource,
    terrain: { castShadow: false, receiveShadow: false },
  });
  // The hillshade is a separate raster layer that only exists in raster-DEM
  // mode; it is added/removed on switch (its DEM source stays registered).
  let hillshadeLayer: Layer | undefined;

  // Switch terrain by re-pointing the terrain layer at the other source. The
  // vector/GeoJSON layers, camera, effects, and panel are all preserved.
  const switchMode = (mode: TerrainMode) => {
    if (mode === currentMode) return;
    currentMode = mode;

    if (mode === "quantizedMesh") {
      terrainLayer.update({
        type: "terrain",
        source: qmSource,
        terrain: { castShadow: false, receiveShadow: false },
      });
      hillshadeLayer?.delete();
      hillshadeLayer = undefined;
    } else {
      terrainLayer.update({
        type: "terrain",
        source: demSource,
        terrain: { castShadow: false, receiveShadow: false },
      });
      hillshadeLayer ??= view.addLayer({
        type: "raster",
        source: demSource,
        hillshade: {},
      });
    }

    const terrainDataset =
      mode === "quantizedMesh"
        ? TERRAIN_DATASETS.reearthQuantizedMesh
        : TERRAIN_DATASETS.gsi;
    attribution.add([terrainDataset, VECTOR_DATASETS.gsiExperimentalVector]);
  };

  attribution.add([
    TERRAIN_DATASETS.reearthQuantizedMesh,
    VECTOR_DATASETS.gsiExperimentalVector,
  ]);

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

  // Keep the camera state in sync so switching terrain preserves the view.
  const syncCamera = () => {
    const pos = view.camera.positionGeographic;
    const orient = view.camera.orientation;
    if (pos?.lng !== undefined) cameraState.lng = pos.lng;
    if (pos?.lat !== undefined) cameraState.lat = pos.lat;
    if (pos?.height !== undefined) cameraState.height = pos.height;
    if (orient?.heading !== undefined) cameraState.heading = orient.heading;
    if (orient?.pitch !== undefined) cameraState.pitch = orient.pitch;
    if (orient?.roll !== undefined) cameraState.roll = orient.roll;
  };
  view.camera.on("moveend", syncCamera);

  // Create control panel
  const pane = new Pane();
  addTerrainControl(pane, () => currentMode, switchMode);
  addCameraControl(view, pane);
};

const addTerrainControl = (
  pane: Pane,
  getMode: () => TerrainMode,
  switchMode: (mode: TerrainMode) => void,
) => {
  const params = { terrain: getMode() };
  const folder = pane.addFolder({ title: "Terrain", expanded: true });
  folder
    .addBinding(params, "terrain", {
      label: "type",
      options: [
        { text: "Quantized Mesh", value: "quantizedMesh" },
        { text: "DEM (Raster)", value: "raster" },
      ],
    })
    .on("change", (ev) => {
      switchMode(ev.value as TerrainMode);
    });
};
