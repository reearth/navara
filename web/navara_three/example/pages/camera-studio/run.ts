import ThreeView, {
  TERRARIUM_ELEVATION_DECODER,
  type EffectHandle,
  type MeshHandle,
} from "@navara/three";
import {
  CloudsEffectDesc,
  RainDropEffectDesc,
  RainMeshDesc,
  SnowMeshDesc,
} from "@navara/three_default_descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";
import { Vector2 } from "three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import {
  TERRAIN_DATASETS,
  TILE_DATASETS,
  TILES_3D_DATASETS,
} from "../../helpers/constants";
import { addDateControl, addHidePaneKeyShortcut } from "../../helpers/control";
import { GOOGLE_MAPS_API_KEY } from "../../helpers/keys";

export type CustomDescriptions = DefaultDescriptions;

type BaseMode = "mapterhorn" | "google";

type CameraState = {
  lng: number;
  lat: number;
  height: number;
  heading: number;
  pitch: number;
  roll: number;
  fov: number;
};

const DEFAULT_FOV = 45;
const DEFAULT_EXPOSURE = 10;

const BASE_CLOUDS = {
  qualityPreset: "high" as const,
  localWeatherVelocity: new Vector2(0.005, 0.001),
  lightShafts: true,
  shadows: true,
  haze: true,
};

// Thin, bright cumulus on a sunny day.
const SUNNY_CLOUDS = {
  ...BASE_CLOUDS,
  coverage: 0.3,
  scatteringCoefficient: 1.0,
  skyLightScale: 1,
  absorptionCoefficient: 0,
  groundBounceScale: 1.0,
  hazeDensityScale: 0.0003,
  hazeExponent: 0.002,
  hazeAbsorptionCoefficient: 1.5,
};

// Heavy, dark overcast deck for rainy/snowy weather.
const STORMY_CLOUDS = {
  ...BASE_CLOUDS,
  coverage: 0.5,
  scatteringCoefficient: 0.6,
  absorptionCoefficient: 5,
  skyLightScale: 0.1,
  groundBounceScale: 0.4,
  hazeDensityScale: 0.0012,
  hazeExponent: 0.004,
  hazeAbsorptionCoefficient: 4,
};

// Pre-deletion default used to seed the eager Clouds pass before any toggle.
const DEFAULT_CLOUDS = SUNNY_CLOUDS;

const DEFAULT_RAIN_DROP = {
  opacity: 0.8,
  dropGridSize: 14,
  dropDensity: 0.1,
  dropLayers: 4,
  dropSizeFactor: 0.025,
  noiseScale: 200,
  refractionStrength: 0.3,
  minDropStrength: 0.01,
  dropFadeStart: 0.3,
  dropFadeEnd: 0.8,
  dropThresholdFactor: 0.08,
  gridDensityLow: 1.15,
  gridDensityHigh: 0.85,
  jitterStrengthLow: 0.45,
  jitterStrengthHigh: 0.08,
};

type CityPreset = {
  name: string;
  lng: number;
  lat: number;
  height: number;
  heading: number;
  pitch: number;
  distance: number;
};

// Targets point at the landmark; `distance` is how far back along the forward
// ray the camera is placed (see CameraPosition.distance in @navara/core).
const CITIES: CityPreset[] = [
  {
    name: "Tokyo (Tokyo Tower)",
    lng: 139.7454,
    lat: 35.6586,
    height: 150,
    heading: 0,
    pitch: -10,
    distance: 800,
  },
  {
    name: "Paris (Eiffel Tower)",
    lng: 2.2945,
    lat: 48.8584,
    height: 150,
    heading: 60,
    pitch: -15,
    distance: 700,
  },
  {
    name: "New York (Statue of Liberty)",
    lng: -74.0445,
    lat: 40.6892,
    height: 50,
    heading: 240,
    pitch: -10,
    distance: 500,
  },
  {
    name: "London (Big Ben)",
    lng: -0.1246,
    lat: 51.5007,
    height: 50,
    heading: 270,
    pitch: -10,
    distance: 400,
  },
  {
    name: "Sydney (Opera House)",
    lng: 151.2153,
    lat: -33.8568,
    height: 30,
    heading: 180,
    pitch: -15,
    distance: 500,
  },
  {
    name: "Dubai (Burj Khalifa)",
    lng: 55.2744,
    lat: 25.1972,
    height: 400,
    heading: 200,
    pitch: -25,
    distance: 1800,
  },
  {
    name: "Rio (Christ the Redeemer)",
    lng: -43.2105,
    lat: -22.9519,
    height: 700,
    heading: 0,
    pitch: -10,
    distance: 400,
  },
  {
    name: "Giza (Pyramids)",
    lng: 31.1342,
    lat: 29.9792,
    height: 50,
    heading: 90,
    pitch: -15,
    distance: 900,
  },
  {
    name: "San Francisco (Golden Gate)",
    lng: -122.4783,
    lat: 37.8199,
    height: 80,
    heading: 200,
    pitch: -10,
    distance: 900,
  },
  {
    name: "Rome (Colosseum)",
    lng: 12.4922,
    lat: 41.8902,
    height: 30,
    heading: 230,
    pitch: -25,
    distance: 500,
  },
];

// Start framed on the first city preset (Tokyo Tower). `distance` is applied
// only on the very first setCamera; after that the engine resolves the camera
// position and "moveend" feeds it back via syncFromCamera, so base-layer
// switches reuse the absolute position without re-orbiting.
const INITIAL_CITY = CITIES[0];
const INITIAL_CAMERA: CameraState = {
  lng: INITIAL_CITY.lng,
  lat: INITIAL_CITY.lat,
  height: INITIAL_CITY.height,
  heading: INITIAL_CITY.heading,
  pitch: INITIAL_CITY.pitch,
  roll: 0,
  fov: DEFAULT_FOV,
};

export const run = async () => {
  let currentMode: BaseMode = "google";
  let cameraState: CameraState = { ...INITIAL_CAMERA };
  let exposureState = DEFAULT_EXPOSURE;
  let firstSetup = true;
  let view: ThreeView<CustomDescriptions> | null = null;
  let pane: Pane | null = null;
  let switching = false;

  const buildMapterhorn = (v: ThreeView<CustomDescriptions>) => {
    v.addLayer({
      type: "tiles",
      data: { url: TILE_DATASETS.eox.url },
      rasterTile: { maxZoom: 16 },
    });

    v.addLayer({
      type: "tiles",
      data: { url: TERRAIN_DATASETS.mapterhorn.url },
      rasterTile: { maxZoom: 17, minZoom: 5 },
      hillshade: {
        elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
      },
    });

    v.addLayer({
      type: "terrain",
      data: { url: TERRAIN_DATASETS.mapterhorn.url },
      rasterTerrain: {
        maxZoom: 17,
        minZoom: 5,
        elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
        castShadow: true,
        receiveShadow: true,
        tileSize: 512,
      },
    });

    showAttributions([TERRAIN_DATASETS.mapterhorn, TILE_DATASETS.eox]);
  };

  const buildGoogle = (v: ThreeView<CustomDescriptions>) => {
    const tiles = v.addLayer({
      type: "cesium3dtiles",
      data: {
        url: `${TILES_3D_DATASETS.googlePhotorealTiles.url}?key=${encodeURIComponent(
          GOOGLE_MAPS_API_KEY,
        )}`,
      },
      model: { maxSse: 60, normals: true },
    });

    showAttributions([TILES_3D_DATASETS.googlePhotorealTiles], [tiles]);
  };

  const setup = async (mode: BaseMode) => {
    currentMode = mode;

    const v = new ThreeView<CustomDescriptions>({
      animation: true,
    });
    view = v;

    const plugin = new DefaultPlugin();
    v.addPlugin(plugin);
    await v.init();

    const defaultScene = plugin.addDefaultPhotorealScene();
    defaultScene.aerialPerspective.update({
      aerialPerspective: {
        irradiance: mode === "google",
      },
    });

    view.toneMappingExposure = exposureState;

    if (firstSetup) {
      v.setCamera({ ...cameraState, distance: INITIAL_CITY.distance });
      firstSetup = false;
    } else {
      v.setCamera({ ...cameraState });
    }
    v.camera.fov = cameraState.fov;

    if (mode === "mapterhorn") {
      buildMapterhorn(v);
    } else {
      buildGoogle(v);
    }

    // Clouds are kept alive (creating/deleting them is expensive); toggle by
    // driving `coverage` between 0 and the default value instead.
    const clouds = v.addEffect<CloudsEffectDesc>({
      clouds: { ...DEFAULT_CLOUDS, coverage: 0 },
    });

    const lazyFactories: LazyFactories = {
      rainDrop: () =>
        v.addEffect<RainDropEffectDesc>({
          rainDrop: { ...DEFAULT_RAIN_DROP },
        }),
      rain: () => v.addMesh<RainMeshDesc>({ rain: {} }),
      snow: () => v.addMesh<SnowMeshDesc>({ snow: {} }),
    };

    const p = new Pane({ title: "Camera Studio", expanded: true });
    pane = p;
    addHidePaneKeyShortcut(p);

    addDateControl(v, p);
    addBaseLayerControl(p, () => currentMode, switchBase);
    addRenderControl(p, v, exposureState, (next) => {
      exposureState = next;
    });
    addEffectsControl(p, clouds, lazyFactories);
    addCameraPanel(p, v, cameraState, (next) => {
      cameraState = next;
    });
  };

  const teardown = () => {
    pane?.dispose();
    pane = null;
    view?.dispose();
    view = null;
  };

  const switchBase = async (mode: BaseMode) => {
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

const addBaseLayerControl = (
  pane: Pane,
  getMode: () => BaseMode,
  switchBase: (mode: BaseMode) => void,
) => {
  const params = { base: getMode() };
  const folder = pane.addFolder({ title: "Base Layer", expanded: true });
  folder
    .addBinding(params, "base", {
      label: "base",
      options: [
        { text: "Mapterhorn terrain", value: "mapterhorn" },
        { text: "Google Photorealistic", value: "google" },
      ],
    })
    .on("change", (ev) => {
      switchBase(ev.value as BaseMode);
    });
};

const addRenderControl = (
  pane: Pane,
  view: ThreeView<CustomDescriptions>,
  initial: number,
  onChange: (value: number) => void,
) => {
  const params = { exposure: initial };
  const folder = pane.addFolder({ title: "Render", expanded: true });
  folder
    .addBinding(params, "exposure", { min: 0, max: 200, step: 0.1 })
    .on("change", (ev) => {
      view.toneMappingExposure = ev.value;
      onChange(ev.value);
    });
};

type LazyFactories = {
  rainDrop: () => EffectHandle<RainDropEffectDesc>;
  rain: () => MeshHandle<RainMeshDesc>;
  snow: () => MeshHandle<SnowMeshDesc>;
};

const addEffectsControl = (
  pane: Pane,
  clouds: EffectHandle<CloudsEffectDesc>,
  factories: LazyFactories,
) => {
  const params = {
    clouds: false,
    rainDrop: false,
    rain: false,
    snow: false,
  };
  const handles: {
    [K in keyof LazyFactories]?: ReturnType<LazyFactories[K]>;
  } = {};
  const folder = pane.addFolder({ title: "Effects", expanded: true });

  // Sync cloud appearance with the combined effect state:
  //   - rain/snow/rainDrop on  → heavy dark storm clouds (forced visible)
  //   - clouds toggle on alone → thin bright sunny clouds
  //   - otherwise              → coverage 0 (invisible)
  const syncClouds = () => {
    const stormy = params.rain || params.snow || params.rainDrop;
    if (params.clouds) {
      if (stormy) {
        clouds.update({ clouds: { ...STORMY_CLOUDS } });
      } else {
        clouds.update({ clouds: { ...SUNNY_CLOUDS } });
      }
    } else {
      clouds.update({ clouds: { coverage: 0 } });
    }
  };

  folder
    .addBinding(params, "clouds", { label: "Clouds" })
    .on("change", syncClouds);

  const bindLazy = (key: keyof LazyFactories, label: string) => {
    folder.addBinding(params, key, { label }).on("change", (ev) => {
      if (ev.value) {
        if (!handles[key]) {
          handles[key] = factories[key]() as never;
        }
      } else {
        handles[key]?.delete();
        handles[key] = undefined;
      }
      syncClouds();
    });
  };

  bindLazy("rainDrop", "Rain Drop");
  bindLazy("rain", "Rain");
  bindLazy("snow", "Snow");
};

const addCameraPanel = (
  pane: Pane,
  view: ThreeView<CustomDescriptions>,
  initial: CameraState,
  onCameraChange: (state: CameraState) => void,
) => {
  const params: CameraState = { ...initial };

  const folder = pane.addFolder({ title: "Camera", expanded: true });

  let ignoreChange = false;

  const emitChange = () => {
    onCameraChange({ ...params });
  };

  const syncFromCamera = () => {
    const pos = view.camera.positionGeographic;
    const orient = view.camera.orientation;
    if (pos?.lng !== undefined) params.lng = pos.lng;
    if (pos?.lat !== undefined) params.lat = pos.lat;
    if (pos?.height !== undefined) params.height = pos.height;
    if (orient?.heading !== undefined) params.heading = orient.heading;
    if (orient?.pitch !== undefined) params.pitch = orient.pitch;
    if (orient?.roll !== undefined) params.roll = orient.roll;
    emitChange();
    ignoreChange = true;
    folder.refresh();
    ignoreChange = false;
  };

  const applySetCamera = () => {
    if (ignoreChange) return;
    view.setCamera({
      lng: params.lng,
      lat: params.lat,
      height: params.height,
      heading: params.heading,
      pitch: params.pitch,
      roll: params.roll,
    });
  };

  folder
    .addBinding(params, "lng", { min: -180, max: 180 })
    .on("change", applySetCamera);
  folder
    .addBinding(params, "lat", { min: -89.999, max: 89.999 })
    .on("change", applySetCamera);
  folder
    .addBinding(params, "height", { min: 1, max: 19070256 })
    .on("change", applySetCamera);
  folder.addBinding(params, "heading").on("change", applySetCamera);
  folder.addBinding(params, "pitch").on("change", applySetCamera);
  folder.addBinding(params, "roll").on("change", applySetCamera);

  folder
    .addBinding(params, "fov", { min: 1, max: 179, step: 0.1 })
    .on("change", (ev) => {
      view.camera.fov = ev.value;
      emitChange();
    });

  view.camera.on("move", syncFromCamera);
  view.camera.on("moveend", syncFromCamera);

  const citiesFolder = folder.addFolder({ title: "Cities" });
  for (const city of CITIES) {
    citiesFolder.addButton({ title: city.name }).on("click", () => {
      // Preserve the current sun elevation at the new location. Must be called
      // before setCamera so `from` reflects the *current* camera position.
      view.atmosphere.setElevationFromCameraAt({
        lat: city.lat,
        lng: city.lng,
      });
      view.setCamera({
        lng: city.lng,
        lat: city.lat,
        height: city.height,
        heading: city.heading,
        pitch: city.pitch,
        roll: 0,
        distance: city.distance,
      });
      // syncFromCamera (from "moveend") will pull the resolved position back
      // into `params` and `cameraState`, so the picked view persists across
      // base-layer switches.
    });
  }

  const copyButton = folder.addButton({ title: "Copy as JS object" });
  const originalCopyTitle = copyButton.title;
  copyButton.on("click", async () => {
    const text = formatCameraSnippet(params);
    try {
      await navigator.clipboard.writeText(text);
      copyButton.title = "Copied!";
      setTimeout(() => {
        copyButton.title = originalCopyTitle;
      }, 1200);
    } catch (e) {
      console.error("Clipboard write failed:", e);
    }
  });

  const pasteButton = folder.addButton({ title: "Paste JS object" });
  const originalPasteTitle = pasteButton.title;
  const flashPasteTitle = (msg: string) => {
    pasteButton.title = msg;
    setTimeout(() => {
      pasteButton.title = originalPasteTitle;
    }, 1500);
  };
  pasteButton.on("click", async () => {
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch (e) {
      console.error("Clipboard read failed:", e);
      flashPasteTitle("Read failed");
      return;
    }

    const parsed = parseCameraSnippet(text);
    if (!parsed) {
      flashPasteTitle("Parse failed");
      return;
    }

    Object.assign(params, parsed);
    view.setCamera({
      lng: params.lng,
      lat: params.lat,
      height: params.height,
      heading: params.heading,
      pitch: params.pitch,
      roll: params.roll,
    });
    view.camera.fov = params.fov;
    emitChange();
    ignoreChange = true;
    folder.refresh();
    ignoreChange = false;
    flashPasteTitle("Pasted!");
  });
};

const parseCameraSnippet = (text: string): CameraState | null => {
  try {
    const fn = new Function(`"use strict"; return (${text});`);
    const obj = fn() as Partial<CameraState>;
    const keys: (keyof CameraState)[] = [
      "lng",
      "lat",
      "height",
      "heading",
      "pitch",
      "roll",
      "fov",
    ];
    const out = {} as CameraState;
    for (const k of keys) {
      const v = obj?.[k];
      if (typeof v !== "number" || !Number.isFinite(v)) return null;
      out[k] = v;
    }
    return out;
  } catch (e) {
    console.error("Camera snippet parse failed:", e);
    return null;
  }
};

const formatCameraSnippet = (p: CameraState): string => {
  const lines = [
    `  lng: ${p.lng},`,
    `  lat: ${p.lat},`,
    `  height: ${p.height},`,
    `  heading: ${p.heading},`,
    `  pitch: ${p.pitch},`,
    `  roll: ${p.roll},`,
    `  fov: ${p.fov},`,
  ];
  return `{\n${lines.join("\n")}\n}`;
};
