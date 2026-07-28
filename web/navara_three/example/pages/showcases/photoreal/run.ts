import ThreeView, {
  TERRARIUM_ELEVATION_DECODER,
  degreeToRadian,
  geodeticToVector3,
  type AttributionPlugin,
} from "@navaramap/three";
import {
  CloudsEffectDesc,
  RainDropEffectDesc,
  RainMeshDesc,
  SnowMeshDesc,
  type CloudsConfig,
  type RainDropConfig,
  type RainMeshConfig,
  type SnowMeshConfig,
} from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { Vector2 } from "three";
import { Pane } from "tweakpane";

import {
  TERRAIN_DATASETS,
  TILE_DATASETS,
  TILES_3D_DATASETS,
} from "../../../helpers/constants";
import {
  addDateControl,
  addHidePaneKeyShortcut,
} from "../../../helpers/control";
import { GOOGLE_MAPS_API_KEY } from "../../../helpers/keys";

dayjs.extend(utc);
dayjs.extend(timezone);

export type CustomDescriptions = DefaultDescriptions;

type TerrainKind = "google" | "mapterhorn";

type SceneCamera = {
  lng: number;
  lat: number;
  heading: number;
  pitch: number;
  distance?: number;
  height?: number;
  roll?: number;
  fov?: number;
};

type SceneDate = {
  year?: number; // 1-9999. Omit to use the current year at run time.
  month?: number; // 1-12. Omit to use the current month.
  day?: number; // 1-31. Omit to use today's day-of-month.
  hour: number; // 0-23 wall-clock hour in `timezone`.
  minute?: number; // 0-59, default 0.
  timezone: string; // IANA name, e.g. "America/New_York".
};

const resolveSceneDate = (date: SceneDate): Date => {
  let dt = dayjs().tz(date.timezone);
  if (date.year !== undefined) dt = dt.year(date.year);
  if (date.month !== undefined) dt = dt.month(date.month - 1);
  if (date.day !== undefined) dt = dt.date(date.day);
  return dt
    .hour(date.hour)
    .minute(date.minute ?? 0)
    .startOf("minute")
    .toDate();
};

type Scene = {
  key: string;
  name: string;
  terrain: TerrainKind;
  camera: SceneCamera;
  date: SceneDate;
  exposure?: number; // toneMappingExposure. Default 10.
  albedoScale?: number;
  clouds?: CloudsConfig["clouds"];
  rainDrop?: RainDropConfig["rainDrop"];
  rain?: RainMeshConfig["rain"];
  snow?: SnowMeshConfig["snow"];
};

const DEFAULT_EXPOSURE = 10;

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
} satisfies NonNullable<RainDropConfig["rainDrop"]>;

const BASE_CLOUDS = {
  qualityPreset: "high" as const,
  localWeatherVelocity: new Vector2(0.001, 0.0),
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
  hazeDensityScale: -4.5,
  hazeExponent: -3.0,
  hazeAbsorptionCoefficient: 0.5,
} satisfies NonNullable<CloudsConfig["clouds"]>;

const SCENES: Scene[] = [
  {
    key: "manhattan",
    name: "Manhattan",
    terrain: "google",
    camera: {
      lng: -73.9709,
      lat: 40.7589,
      heading: -115.1,
      pitch: -34.9,
      distance: 3000,
      fov: 75,
    },
    date: {
      year: 2025,
      month: 1,
      day: 1,
      hour: 7,
      minute: 32,
      timezone: "America/New_York",
    },
    exposure: 60,
  },
  {
    key: "fuji-clouds",
    name: "Fuji Clouds",
    terrain: "mapterhorn",
    camera: {
      lng: 138.634,
      lat: 35.5,
      heading: 181,
      pitch: -27,
      distance: 8444,
      fov: 75,
    },
    albedoScale: Math.PI,
    date: {
      year: 2025,
      month: 6,
      day: 15,
      hour: 17,
      minute: 30,
      timezone: "Asia/Tokyo",
    },
    clouds: { ...SUNNY_CLOUDS, coverage: 0.4, qualityPreset: "high" },
  },
  {
    key: "tokyo-clouds",
    name: "Tokyo Clouds",
    terrain: "google",
    camera: {
      lng: 139.8146,
      lat: 35.7455,
      heading: -160,
      pitch: -8.9,
      distance: 1000,
      fov: 75,
    },
    date: {
      year: 2025,
      month: 5,
      day: 20,
      hour: 7,
      minute: 30,
      timezone: "Asia/Tokyo",
    },
    clouds: { ...SUNNY_CLOUDS, coverage: 0.35, qualityPreset: "high" },
  },
  {
    key: "london-clouds",
    name: "London Clouds",
    terrain: "google",
    camera: {
      lng: -0.1293,
      lat: 51.4836,
      heading: -176,
      pitch: -6.8,
      distance: 3231,
      fov: 75,
    },
    date: {
      year: 2025,
      month: 1,
      day: 1,
      hour: 9,
      minute: 24,
      timezone: "Europe/London",
    },
    clouds: { ...SUNNY_CLOUDS, coverage: 0.35, qualityPreset: "high" },
  },
  {
    key: "shinjuku-rainy",
    name: "Shinjuku Rainy",
    terrain: "google",
    camera: {
      lng: 139.68670288198805,
      lat: 35.715295600673855,
      height: 733.904616184813,
      heading: 162.16350828522565,
      pitch: -10.82780593672396,
      roll: 0.00004451042556347689,
      fov: 18.4,
    },
    date: {
      year: 2025,
      month: 1,
      day: 1,
      hour: 16,
      minute: 0,
      timezone: "Asia/Tokyo",
    },
    exposure: 60,
    albedoScale: 0.5,
    clouds: {
      ...SUNNY_CLOUDS,
      coverage: 0.35,
      qualityPreset: "high",
      absorptionCoefficient: 5,
      localWeatherVelocity: new Vector2(0),
      localWeatherOffset: new Vector2(0.6, -0.3),
    },
    rain: {},
    rainDrop: { ...DEFAULT_RAIN_DROP },
  },
];

const SCENE_URL_PARAM = "scene";

const readSceneFromUrl = (): Scene => {
  const key = new URLSearchParams(window.location.search).get(SCENE_URL_PARAM);
  return SCENES.find((s) => s.key === key) ?? SCENES[0];
};

const writeSceneToUrl = (key: string) => {
  const url = new URL(window.location.href);
  url.searchParams.set(SCENE_URL_PARAM, key);
  window.history.replaceState({}, "", url.toString());
};

const buildGoogle = (
  v: ThreeView<CustomDescriptions>,
  attribution: AttributionPlugin | undefined,
) => {
  const tiles = v.addLayer({
    type: "cesium3dtiles",
    data: {
      url: `${TILES_3D_DATASETS.googlePhotorealTiles.url}?key=${encodeURIComponent(
        GOOGLE_MAPS_API_KEY,
      )}`,
    },
    model: {
      maxSse: 40,
      normals: true,
    },
  });

  attribution?.add([
    {
      ...TILES_3D_DATASETS.googlePhotorealTiles,
      creditLayerId: tiles.id,
    },
  ]);
};

const buildMapterhorn = (
  v: ThreeView<CustomDescriptions>,
  attribution: AttributionPlugin | undefined,
) => {
  v.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.gsiSeamlessphoto.url },
    rasterTile: { maxZoom: 18 },
  });
  v.addLayer({
    type: "tiles",
    data: { url: TERRAIN_DATASETS.mapterhorn.url },
    rasterTile: { maxZoom: 17, minZoom: 5 },
    hillshade: {
      elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
      exaggeration: 0.3,
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

  attribution?.add([
    TERRAIN_DATASETS.mapterhorn,
    TILE_DATASETS.gsiSeamlessphoto,
  ]);
};

export const run = async () => {
  let view: ThreeView<CustomDescriptions> | null = null;
  let attribution: AttributionPlugin | undefined;
  let pane: Pane | null = null;
  let switching = false;
  let currentScene = readSceneFromUrl();

  const setup = async (scene: Scene) => {
    currentScene = scene;

    const v = new ThreeView<CustomDescriptions>({ animation: true });
    view = v;

    const plugin = new DefaultPlugin();
    v.addPlugin(plugin);

    attribution = v.attribution;

    await v.init();

    const defaultScene = plugin.addDefaultPhotorealScene();
    defaultScene.aerialPerspective.update({
      aerialPerspective: {
        sun: true,
        sky: true,
        irradiance: true,
        albedoScale: scene.albedoScale,
      },
    });
    defaultScene.sky.delete();

    v.toneMappingExposure = scene.exposure ?? DEFAULT_EXPOSURE;

    v.setCamera({
      lng: scene.camera.lng,
      lat: scene.camera.lat,
      height: scene.camera.height ?? 0,
      heading: scene.camera.heading,
      pitch: scene.camera.pitch,
      roll: scene.camera.roll ?? 0,
      distance: scene.camera.distance,
    });
    if (scene.camera.fov !== undefined) {
      v.camera.fov = scene.camera.fov;
    }

    if (scene.terrain === "google") {
      buildGoogle(v, attribution);
    } else {
      buildMapterhorn(v, attribution);
    }

    if (scene.clouds) {
      v.addEffect<CloudsEffectDesc>({ clouds: scene.clouds });
    }
    if (scene.rainDrop) {
      v.addEffect<RainDropEffectDesc>({ rainDrop: scene.rainDrop });
    }
    if (scene.rain || scene.snow) {
      const meshPosition = geodeticToVector3({
        lat: degreeToRadian(scene.camera.lat),
        lng: degreeToRadian(scene.camera.lng),
        height: 10,
      });
      if (scene.rain) {
        v.addMesh<RainMeshDesc>({ position: meshPosition, rain: scene.rain });
      }
      if (scene.snow) {
        v.addMesh<SnowMeshDesc>({ position: meshPosition, snow: scene.snow });
      }
    }

    v.atmosphere.date = resolveSceneDate(scene.date);

    const p = new Pane({ title: "Photoreal Showcases", expanded: true });
    pane = p;

    addDateControl(v, p, v.atmosphere.date, scene.date.timezone);
    addHidePaneKeyShortcut(p);
    addSceneControl(p, scene.key, switchScene);
  };

  const teardown = () => {
    pane?.dispose();
    pane = null;
    // view.dispose() also tears down the owned attribution UI.
    view?.dispose();
    view = null;
    attribution = undefined;
  };

  const switchScene = async (key: string) => {
    if (switching || key === currentScene.key) return;
    const next = SCENES.find((s) => s.key === key);
    if (!next) return;
    switching = true;
    try {
      writeSceneToUrl(key);
      teardown();
      await setup(next);
    } finally {
      switching = false;
    }
  };

  await setup(currentScene);
};

const addSceneControl = (
  pane: Pane,
  current: string,
  switchScene: (key: string) => void,
) => {
  const params = { scene: current };
  pane
    .addFolder({ title: "Scene" })
    .addBinding(params, "scene", {
      label: "",
      options: SCENES.map((s) => ({ text: s.name, value: s.key })),
    })
    .on("change", (ev) => {
      switchScene(ev.value as string);
    });
};
