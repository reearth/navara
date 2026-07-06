import ThreeView, { Color, JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import { ToneMappingMode } from "@navara/three_default_descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";
import { SphericalHarmonics3 } from "three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import { TERRAIN_DATASETS, VECTOR_DATASETS } from "../../helpers/constants";
import { addCameraControl } from "../../helpers/control";
import { SH_COEFFICIENTS } from "../../helpers/sh";

export type CustomDescriptions = DefaultDescriptions;

// Which terrain source drives the 3D surface. The terrain layer cannot be
// swapped in place, so switching disposes the whole ThreeView and rebuilds it
// (mirroring the camera-studio page).
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
  let view: ThreeView<CustomDescriptions> | null = null;
  let pane: Pane | null = null;
  let switching = false;

  // Registers the terrain source(s) for the given mode using the Source API.
  // The 3D surface is driven either by a quantized-mesh source or by a
  // raster-dem source (which additionally feeds a hillshade raster layer).
  const addTerrain = (v: ThreeView<CustomDescriptions>, mode: TerrainMode) => {
    if (mode === "quantizedMesh") {
      const qm = v.addSource({
        type: "quantized-mesh",
        url: TERRAIN_DATASETS.reearthQuantizedMesh.url,
        maxZoom: 18,
        requestVertexNormals: true,
      });
      v.addLayer({
        type: "terrain",
        source: qm,
        terrain: { castShadow: false, receiveShadow: false },
      });
    } else {
      // GSI DEM as a raster-dem source, shared by the terrain and the hillshade.
      const dem = v.addSource({
        type: "raster-dem",
        url: TERRAIN_DATASETS.gsi.url,
        elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
        maxZoom: 15,
        minZoom: 5,
      });
      v.addLayer({
        type: "terrain",
        source: dem,
        terrain: { castShadow: false, receiveShadow: false },
      });
      v.addLayer({
        type: "raster",
        source: dem,
        hillshade: {},
      });
    }
  };

  const setup = async (mode: TerrainMode) => {
    currentMode = mode;

    const v = new ThreeView<CustomDescriptions>({
      debug: true,
    });
    view = v;

    v.addPlugin(new DefaultPlugin());

    await v.init();

    v.addLight({ ambient: {} });

    v.toneMappingExposure = 3;

    v.addEffect({
      toneMapping: {
        mode: ToneMappingMode.REINHARD2,
      },
    });

    v.addEffect({
      smaa: {},
    });

    v.addLight({
      lightProbe: {
        sh: new SphericalHarmonics3().set(SH_COEFFICIENTS.white),
        intensity: 1,
      },
    });

    v.setCamera({ ...cameraState });

    // Add terrain layer for 3D surface (quantized-mesh or raster DEM).
    addTerrain(v, mode);

    // A single vector-tile source shared by multiple vector layers; each layer
    // renders a different source layer of the same tileset.
    const vectorTiles = v.addSource({
      type: "vector-tile",
      url: VECTOR_DATASETS.gsiExperimentalVector.url,
      maxZoom: 16,
    });

    v.addLayer({
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
    v.addLayer({
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
    v.addLayer({
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
    v.addLayer({
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

    const geojsonSource = v.addSource({
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
    v.addLayer({
      type: "vector",
      source: geojsonSource,
      polygon: {
        color: new Color().setStyle("#00aaff"),
        clampToGround: true,
      },
    });

    // Keep the camera state in sync so switching terrain preserves the view.
    const syncCamera = () => {
      const pos = v.camera.positionGeographic;
      const orient = v.camera.orientation;
      if (pos?.lng !== undefined) cameraState.lng = pos.lng;
      if (pos?.lat !== undefined) cameraState.lat = pos.lat;
      if (pos?.height !== undefined) cameraState.height = pos.height;
      if (orient?.heading !== undefined) cameraState.heading = orient.heading;
      if (orient?.pitch !== undefined) cameraState.pitch = orient.pitch;
      if (orient?.roll !== undefined) cameraState.roll = orient.roll;
    };
    v.camera.on("moveend", syncCamera);

    // Create control panel
    const p = new Pane();
    pane = p;
    addTerrainControl(p, () => currentMode, switchMode);
    addCameraControl(v, p);

    const terrainDataset =
      mode === "quantizedMesh"
        ? TERRAIN_DATASETS.reearthQuantizedMesh
        : TERRAIN_DATASETS.gsi;
    showAttributions([terrainDataset, VECTOR_DATASETS.gsiExperimentalVector]);
  };

  const teardown = () => {
    pane?.dispose();
    pane = null;
    view?.dispose();
    view = null;
  };

  const switchMode = async (mode: TerrainMode) => {
    if (switching || mode === currentMode) return;
    switching = true;
    try {
      teardown();
      await setup(mode);
    } finally {
      switching = false;
    }
  };

  await setup(currentMode);
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
      const value = ev.value as TerrainMode;
      // Defer so tweakpane finishes emitting this change before switchMode
      // disposes the pane (disposing mid-emit throws "already disposed").
      queueMicrotask(() => switchMode(value));
    });
};
