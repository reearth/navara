import ThreeView, {
  TERRARIUM_ELEVATION_DECODER,
  degreeToRadian,
  radianToDegree,
  type AttributionItem,
  type AttributionPlugin,
  type EffectHandle,
  type Layer,
  type MeshHandle,
  type Source,
} from "@navaramap/three";
import {
  CloudsEffectDesc,
  RainDropEffectDesc,
  RainMeshDesc,
  SnowMeshDesc,
} from "@navaramap/three_default_descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three_default_plugin";
import { PersonViewPlugin, type ViewMode } from "@navaramap/three_plugins";
import { Vector2 } from "three";
import { Pane } from "tweakpane";

import {
  LOCAL_DATASETS,
  TERRAIN_DATASETS,
  TILE_DATASETS,
  TILES_3D_DATASETS,
} from "../../helpers/constants";
import { addDateControl, addHidePaneKeyShortcut } from "../../helpers/control";
import { GOOGLE_MAPS_API_KEY } from "../../helpers/keys";

export type CustomDescriptions = DefaultDescriptions;

type BaseMode = "mapterhorn" | "google";

// "normal" drives the free orbit camera (setCamera + tweakpane sliders).
// "person" hands camera control to PersonViewPlugin (Soldier character,
// TPV/FPV) so the character orientation and a person-anchored camera can
// be authored and exported as a PersonViewPlugin config.
type ViewKind = "normal" | "person";

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

// Whether the person-view camera starts in free-look (always-free) mode.
// Shared between PersonViewPlugin construction and the panel toggle default.
const PERSON_FREE_LOOK_DEFAULT = true;

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
// ray the camera is placed (see CameraPosition.distance in @navaramap/core).
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
  let currentKind: ViewKind = "normal";
  let cameraState: CameraState = { ...INITIAL_CAMERA };
  let exposureState = DEFAULT_EXPOSURE;
  let firstSetup = true;
  let view: ThreeView<CustomDescriptions> | null = null;
  let personView: PersonViewPlugin | null = null;
  let attribution: AttributionPlugin | undefined;
  let pane: Pane | null = null;
  let switching = false;

  const applyAttribution = (base: AttributionItem[]) => {
    attribution?.clear();
    attribution?.add(base);
  };
  let defaultScene: ReturnType<
    DefaultPlugin["addDefaultPhotorealScene"]
  > | null = null;

  // Handles for the current base's layers/sources so a base switch can tear them
  // down on the live view (delete layers, then their sources — sources are
  // reference-counted) without disposing the ThreeView.
  let baseLayers: Layer[] = [];
  let baseSources: Source[] = [];

  const buildMapterhorn = (
    v: ThreeView<CustomDescriptions>,
  ): AttributionItem[] => {
    const eoxSource = v.addSource({
      type: "raster-tile",
      url: TILE_DATASETS.eox.url,
      maxZoom: 16,
    });
    baseSources.push(eoxSource);
    baseLayers.push(v.addLayer({ type: "raster", source: eoxSource }));

    // Mapterhorn DEM as a single raster-dem source, shared by the hillshade
    // raster layer and the terrain layer (both reference it; the source is
    // reference-counted so it is only freed once both layers are deleted).
    const demSource = v.addSource({
      type: "raster-dem",
      url: TERRAIN_DATASETS.mapterhorn.url,
      maxZoom: 17,
      minZoom: 5,
      elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
      tileSize: 512,
    });
    baseSources.push(demSource);
    baseLayers.push(
      v.addLayer({ type: "raster", source: demSource, hillshade: {} }),
    );
    baseLayers.push(
      v.addLayer({
        type: "terrain",
        source: demSource,
        terrain: { castShadow: true, receiveShadow: true },
      }),
    );

    return [TERRAIN_DATASETS.mapterhorn, TILE_DATASETS.eox];
  };

  const buildGoogle = (v: ThreeView<CustomDescriptions>): AttributionItem[] => {
    const source = v.addSource({
      type: "3d-tiles",
      url: `${TILES_3D_DATASETS.googlePhotorealTiles.url}?key=${encodeURIComponent(
        GOOGLE_MAPS_API_KEY,
      )}`,
    });
    baseSources.push(source);
    const tiles = v.addLayer({
      type: "3d-tiles",
      source,
      model: { maxSse: 60, normals: true },
    });
    baseLayers.push(tiles);

    return [
      {
        ...TILES_3D_DATASETS.googlePhotorealTiles,
        creditLayerId: tiles.id,
      },
    ];
  };

  const buildBase = (
    v: ThreeView<CustomDescriptions>,
    mode: BaseMode,
  ): AttributionItem[] => {
    baseLayers = [];
    baseSources = [];
    return mode === "mapterhorn" ? buildMapterhorn(v) : buildGoogle(v);
  };

  // Tear down the current base on the live view: delete every layer first, then
  // its sources (reference-counted, freed once no layer references them).
  const teardownBase = () => {
    for (const l of baseLayers) l.delete();
    for (const s of baseSources) {
      const removed = s.delete();
      console.log("[camera-studio] source deleted:", removed);
    }
    baseLayers = [];
    baseSources = [];
  };

  const setup = async (mode: BaseMode, kind: ViewKind) => {
    currentMode = mode;
    currentKind = kind;

    const v = new ThreeView<CustomDescriptions>({
      animation: true,
    });
    view = v;

    const plugin = new DefaultPlugin();
    v.addPlugin(plugin);

    attribution = v.attribution;

    // PersonViewPlugin must be registered before init(). Seed it from the
    // current camera state so the position carries over from normal mode.
    if (kind === "person") {
      personView = new PersonViewPlugin({
        character: {
          modelUrl: LOCAL_DATASETS.soldierGLTF.url,
          animation: {
            idleClip: "Idle",
            walkClip: "Walk",
            dashClip: "Run",
            speed: 1,
            crossfadeDuration: 0.3,
          },
          modelRotationOffset: { x: Math.PI / 2, y: 0, z: 0 },
          modelScale: 1,
          castShadow: true,
          receiveShadow: true,
        },
        initialView: "tpv",
        moveSpeed: 5,
        altSpeed: 5,
        rotationSpeed: 4,
        allowCameraControl: PERSON_FREE_LOOK_DEFAULT,
        startLat: cameraState.lat,
        startLng: cameraState.lng,
        startHeight: cameraState.height,
        startHeading: degreeToRadian(cameraState.heading),
        minAlt: -1000,
        maxAlt: 1_000_000,
        cameraDistance: 10,
      });
      v.addPlugin(personView);
    }

    await v.init();

    defaultScene = plugin.addDefaultPhotorealScene();
    defaultScene.aerialPerspective.update({
      aerialPerspective: {
        irradiance: mode === "google",
      },
    });

    view.toneMappingExposure = exposureState;

    if (kind === "person") {
      // PersonViewPlugin drives the camera every frame; do not call
      // setCamera here or it would fight the per-frame follow.
      personView?.start();
    } else if (firstSetup) {
      v.setCamera({ ...cameraState, distance: INITIAL_CITY.distance });
      firstSetup = false;
    } else {
      v.setCamera({ ...cameraState });
    }
    v.camera.fov = cameraState.fov;

    applyAttribution(buildBase(v, mode));

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
    addViewModeControl(p, () => currentKind, switchViewKind);
    addRenderControl(p, v, exposureState, (next) => {
      exposureState = next;
    });
    addEffectsControl(p, clouds, lazyFactories);
    if (kind === "person" && personView) {
      addPersonPanel(p, v, personView, cameraState, (next) => {
        cameraState = next;
      });
    } else {
      addCameraPanel(p, v, cameraState, (next) => {
        cameraState = next;
      });
    }
  };

  const teardown = () => {
    pane?.dispose();
    pane = null;
    // Dispose the plugin before the view so its keyboard listeners and
    // requestAnimationFrame loop are torn down (the view does not own them).
    personView?.dispose();
    personView = null;
    // The attribution UI is owned by the view now, so view.dispose() tears it
    // down; no manual disposal needed.
    attribution = undefined;
    view?.dispose();
    view = null;
  };

  const rebuild = async () => {
    switching = true;
    try {
      teardown();
      await setup(currentMode, currentKind);
    } finally {
      switching = false;
    }
  };

  // Base switch is a live operation: tear down the current base's layers and
  // sources and build the new one on the same ThreeView (no dispose/recreate),
  // preserving the camera, effects, and panel. Only the view-kind switch below
  // still rebuilds, since PersonViewPlugin must be registered before init().
  const switchBase = (mode: BaseMode) => {
    if (switching || mode === currentMode || !view) return;
    currentMode = mode;
    teardownBase();
    applyAttribution(buildBase(view, mode));
    defaultScene?.aerialPerspective.update({
      aerialPerspective: { irradiance: mode === "google" },
    });
  };

  const switchViewKind = async (kind: ViewKind) => {
    if (switching || kind === currentKind) return;
    currentKind = kind;
    await rebuild();
  };

  await setup(currentMode, currentKind);
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

const addViewModeControl = (
  pane: Pane,
  getKind: () => ViewKind,
  switchViewKind: (kind: ViewKind) => void,
) => {
  const folder = pane.addFolder({ title: "View Mode", expanded: true });
  // The pane is rebuilt on every setup(), so the title reflects the kind
  // that will be active after the toggle for the current build.
  const target: ViewKind = getKind() === "normal" ? "person" : "normal";
  const label =
    target === "person"
      ? "Switch to Person view (Soldier)"
      : "Switch to Normal camera";
  folder.addButton({ title: label }).on("click", () => {
    switchViewKind(target);
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

const addPersonPanel = (
  pane: Pane,
  view: ThreeView<CustomDescriptions>,
  personView: PersonViewPlugin,
  initial: CameraState,
  onCameraChange: (state: CameraState) => void,
) => {
  // Person view only authors position + heading; pitch/roll/fov are carried
  // over untouched so toggling back to the normal camera preserves them.
  // CameraState stays in degrees (shared with the normal camera), while the
  // person heading is authored in radians to match PersonViewPlugin's
  // startHeading / teleport units so the copied config pastes verbatim.
  const params: CameraState = { ...initial };
  const personParams = {
    heading: degreeToRadian(initial.heading),
    cameraPitch: personView.getCameraPitch(),
    fpvPitch: personView.getFpvPitch(),
    fpvHeightOffset: personView.getFpvHeightOffset(),
  };

  const folder = pane.addFolder({
    title: "Camera (Person View)",
    expanded: true,
  });

  let ignoreChange = false;

  // View mode (TPV/FPV). The "V" key also toggles it inside the plugin, so
  // keep this binding in sync via onStateChange below.
  const viewParams = { mode: personView.getState().mode };
  folder
    .addBinding(viewParams, "mode", {
      label: "view",
      options: [
        { text: "Third person (TPV)", value: "tpv" },
        { text: "First person (FPV)", value: "fpv" },
      ],
    })
    .on("change", (ev) => {
      personView.setViewMode(ev.value as ViewMode);
    });

  // Free look: when on, the camera is always free (mouse drag rotates the
  // view). When off, the camera chases the character and Alt-hold gives a
  // temporary free look. Defaults to the constructed `allowCameraControl`.
  const controlParams = { freeLook: PERSON_FREE_LOOK_DEFAULT };
  folder
    .addBinding(controlParams, "freeLook", { label: "free look" })
    .on("change", (ev) => {
      personView.setAllowCameraControl(ev.value);
    });

  // Live position readouts driven by the plugin's per-frame state.
  folder.addBinding(params, "lng", { readonly: true });
  folder.addBinding(params, "lat", { readonly: true });
  folder.addBinding(params, "height", { readonly: true, label: "alt" });

  // Heading (radians) is editable so the character orientation can be
  // fine-tuned; applying it rotates the character in place.
  folder
    .addBinding(personParams, "heading", { label: "heading (rad)" })
    .on("change", () => {
      if (ignoreChange) return;
      personView.setHeading(personParams.heading);
    });

  // TPV camera pitch (radians). Orbits the camera up and over the model
  // while keeping it centered.
  folder
    .addBinding(personParams, "cameraPitch", {
      label: "tpv pitch (rad)",
      min: -1.5,
      max: 1.5,
      step: 0.01,
    })
    .on("change", () => {
      if (ignoreChange) return;
      personView.setCameraPitch(personParams.cameraPitch);
    });

  // FPV camera pitch (radians). Tilts the first-person view down in place.
  folder
    .addBinding(personParams, "fpvPitch", {
      label: "fpv pitch (rad)",
      min: -1.5,
      max: 1.5,
      step: 0.01,
    })
    .on("change", () => {
      if (ignoreChange) return;
      personView.setFpvPitch(personParams.fpvPitch);
    });

  // FPV eye height offset (meters). Also the shared eye-line height used by TPV.
  folder
    .addBinding(personParams, "fpvHeightOffset", {
      label: "fpv height (m)",
      min: 0,
      max: 100,
      step: 0.5,
    })
    .on("change", () => {
      if (ignoreChange) return;
      personView.setFpvHeightOffset(personParams.fpvHeightOffset);
    });

  folder
    .addBinding(params, "fov", { min: 1, max: 179, step: 0.1 })
    .on("change", (ev) => {
      view.camera.fov = ev.value;
      onCameraChange({ ...params });
    });

  personView.onStateChange((s) => {
    params.lng = s.lng;
    params.lat = s.lat;
    params.height = s.alt;
    // s.heading is radians; keep CameraState (degrees) in sync for the
    // normal-mode carryover and the "Copy camera state" snippet.
    personParams.heading = s.heading;
    params.heading = radianToDegree(s.heading);
    viewParams.mode = s.mode;
    onCameraChange({ ...params });
    ignoreChange = true;
    folder.refresh();
    ignoreChange = false;
  });

  const citiesFolder = folder.addFolder({ title: "Cities" });
  for (const city of CITIES) {
    citiesFolder.addButton({ title: city.name }).on("click", () => {
      // Preserve the current sun elevation at the new location, mirroring the
      // normal camera panel's behaviour.
      view.atmosphere.setElevationFromCameraAt({
        lat: city.lat,
        lng: city.lng,
      });
      personView.teleport({
        lng: city.lng,
        lat: city.lat,
        alt: city.height,
        heading: degreeToRadian(city.heading),
      });
    });
  }

  addClipboardCopyButton(folder, "Copy PersonViewPlugin config", () =>
    formatPersonViewSnippet(
      params,
      personParams.heading,
      personParams.cameraPitch,
      personParams.fpvPitch,
      personParams.fpvHeightOffset,
      personView.getState().mode,
    ),
  );
  addClipboardCopyButton(folder, "Copy camera state", () =>
    formatCameraSnippet(params),
  );

  // Accepts either a PersonViewPlugin config snippet (startLat/…/startHeading
  // in radians) or a CameraState snippet (lat/…/heading in degrees). The two
  // are distinguishable by their key names, so try the person config first.
  addClipboardPasteButton(folder, "Paste config / camera state", (text) => {
    const personCfg = parsePersonViewSnippet(text);
    if (personCfg) {
      if (personCfg.initialView) personView.setViewMode(personCfg.initialView);
      if (personCfg.cameraPitch !== null) {
        personParams.cameraPitch = personCfg.cameraPitch;
        personView.setCameraPitch(personCfg.cameraPitch);
      }
      if (personCfg.fpvPitch !== null) {
        personParams.fpvPitch = personCfg.fpvPitch;
        personView.setFpvPitch(personCfg.fpvPitch);
      }
      if (personCfg.fpvHeightOffset !== null) {
        personParams.fpvHeightOffset = personCfg.fpvHeightOffset;
        personView.setFpvHeightOffset(personCfg.fpvHeightOffset);
      }
      personView.teleport({
        lng: personCfg.startLng,
        lat: personCfg.startLat,
        alt: personCfg.startHeight,
        heading: personCfg.startHeading,
      });
      ignoreChange = true;
      folder.refresh();
      ignoreChange = false;
      return true;
    }
    const cam = parseCameraSnippet(text);
    if (cam) {
      // pitch/roll/fov are not driven by the person camera; keep them in the
      // shared CameraState so toggling back to normal preserves them.
      params.pitch = cam.pitch;
      params.roll = cam.roll;
      params.fov = cam.fov;
      view.camera.fov = cam.fov;
      personView.teleport({
        lng: cam.lng,
        lat: cam.lat,
        alt: cam.height,
        heading: degreeToRadian(cam.heading),
      });
      return true;
    }
    return false;
  });
};

const addClipboardCopyButton = (
  folder: ReturnType<Pane["addFolder"]>,
  title: string,
  getText: () => string,
) => {
  const button = folder.addButton({ title });
  const originalTitle = button.title;
  button.on("click", async () => {
    try {
      await navigator.clipboard.writeText(getText());
      button.title = "Copied!";
      setTimeout(() => {
        button.title = originalTitle;
      }, 1200);
    } catch (e) {
      console.error("Clipboard write failed:", e);
    }
  });
};

// Reads the clipboard and hands the text to `apply`, which returns whether it
// could parse and apply the snippet. The button title flashes the outcome.
const addClipboardPasteButton = (
  folder: ReturnType<Pane["addFolder"]>,
  title: string,
  apply: (text: string) => boolean,
) => {
  const button = folder.addButton({ title });
  const originalTitle = button.title;
  const flash = (msg: string) => {
    button.title = msg;
    setTimeout(() => {
      button.title = originalTitle;
    }, 1500);
  };
  button.on("click", async () => {
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch (e) {
      console.error("Clipboard read failed:", e);
      flash("Read failed");
      return;
    }
    flash(apply(text) ? "Pasted!" : "Parse failed");
  });
};

type PersonViewSnippet = {
  startLat: number;
  startLng: number;
  startHeight: number;
  startHeading: number;
  cameraPitch: number | null;
  fpvPitch: number | null;
  fpvHeightOffset: number | null;
  initialView: ViewMode | null;
};

const parsePersonViewSnippet = (text: string): PersonViewSnippet | null => {
  const readNumber = (key: string): number | null => {
    const re = new RegExp(
      String.raw`${key}\s*:\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)`,
    );
    const m = text.match(re);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
  };

  const startLat = readNumber("startLat");
  const startLng = readNumber("startLng");
  const startHeight = readNumber("startHeight");
  const startHeading = readNumber("startHeading");
  if (
    startLat === null ||
    startLng === null ||
    startHeight === null ||
    startHeading === null
  ) {
    return null;
  }

  const viewMatch = text.match(/initialView\s*:\s*["']?(tpv|fpv)["']?/);
  const initialView = (viewMatch?.[1] as ViewMode | undefined) ?? null;

  return {
    startLat,
    startLng,
    startHeight,
    startHeading,
    cameraPitch: readNumber("cameraPitch"),
    fpvPitch: readNumber("fpvPitch"),
    fpvHeightOffset: readNumber("fpvHeightOffset"),
    initialView,
  };
};

const parseCameraSnippet = (text: string): CameraState | null => {
  const readNumber = (key: keyof CameraState): number | null => {
    const re = new RegExp(
      String.raw`${key}\s*:\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)`,
    );
    const m = text.match(re);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
  };

  const out = {} as CameraState;
  for (const k of [
    "lng",
    "lat",
    "height",
    "heading",
    "pitch",
    "roll",
    "fov",
  ] as const) {
    const n = readNumber(k);
    if (n === null) return null;
    out[k] = n;
  }
  return out;
};

// Emits an object that can be spread straight into `new PersonViewPlugin({…})`.
// `startHeading` is in radians, matching the plugin's unit and the radian
// heading shown in the panel, so the value can be pasted verbatim.
const formatPersonViewSnippet = (
  p: CameraState,
  headingRad: number,
  cameraPitchRad: number,
  fpvPitchRad: number,
  fpvHeightOffset: number,
  mode: ViewMode,
): string => {
  const lines = [
    `  startLat: ${p.lat},`,
    `  startLng: ${p.lng},`,
    `  startHeight: ${p.height},`,
    `  startHeading: ${headingRad},`,
    `  cameraPitch: ${cameraPitchRad},`,
    `  fpvPitch: ${fpvPitchRad},`,
    `  fpvHeightOffset: ${fpvHeightOffset},`,
    `  initialView: "${mode}",`,
  ];
  return `{\n${lines.join("\n")}\n}`;
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
