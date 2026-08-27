/**
 * Screenshot rig for the docs tutorials. Each mode mirrors the code shown in
 * `docs/src/content/docs/three/Tutorial/*.md` so the published images stay in
 * sync with the snippets.
 *
 * ?m=clouds|rain|snow|water|ssr   realistic-atmosphere.md
 * ?m=interior                    interior-explore.md
 * ?exp=<number>                  overrides toneMappingExposure
 */
import ThreeView, { Color } from "@navaramap/three";
import type {
  CloudsEffectDesc,
  RainDropEffectDesc,
  RainMeshDesc,
  SnowMeshDesc,
  SSREffectDesc,
} from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";

const q = new URLSearchParams(location.search);
const MODE = q.get("m") ?? "clouds";
const expOverride = q.get("exp");

const exposure = (value: number) => (expOverride ? Number(expOverride) : value);

/** Camera overrides for tuning a shot without editing the documented values. */
const camera = (c: {
  lng: number;
  lat: number;
  height: number;
  heading: number;
  pitch: number;
}) => ({
  lng: Number(q.get("lng") ?? c.lng),
  lat: Number(q.get("lat") ?? c.lat),
  height: Number(q.get("h") ?? c.height),
  heading: Number(q.get("hd") ?? c.heading),
  pitch: Number(q.get("p") ?? c.pitch),
  roll: 0,
});

if (MODE === "interior") {
  const { PersonViewPlugin } = await import("@navaramap/three-plugins");

  const plugin = new DefaultPlugin();
  const view = new ThreeView<DefaultDescriptions>({
    shadow: true,
    backgroundColor: new Color().setStyle("#475668"),
  });
  view.addPlugin(plugin);

  const startLat = 35.6341630282;
  const startLng = 139.7420527162;
  const startHeight = 59.05;
  const startHeading = 288;

  const personView = new PersonViewPlugin({
    character: {
      modelUrl: "/glTF/Soldier/Soldier.glb",
      animation: {
        idleClip: "Idle",
        walkClip: "Walk",
        dashClip: "Run",
        speed: 1.0,
        crossfadeDuration: 0.3,
      },
      modelRotationOffset: { x: Math.PI / 2, y: 0, z: 0 },
      modelScale: 1,
      castShadow: true,
      receiveShadow: true,
    },
    moveSpeed: 5,
    altSpeed: 5,
    rotationSpeed: 2,
    cameraDistance: 8,
    cameraPitch: 3.44,
    cameraLerpSpeed: 4,
    minAlt: -1000,
    maxAlt: 5000,
    startLat,
    startLng,
    startHeight,
    startHeading,
    allowCameraControl: true,
  });

  view.addPlugin(personView);
  await view.init();

  view.atmosphere.date.setHours(8);
  view.toneMappingExposure = exposure(10);

  const layers = plugin.addDefaultPhotorealScene();
  layers.sun.update({
    sun: { castShadow: true, shadowFar: 1000, shadowLambda: 1 },
  });

  const terrainSource = view.addSource({
    type: "quantized-mesh",
    url: "https://terrain.reearth.land/cesium-mesh/ellipsoid/{z}/{x}/{y}.terrain",
    requestVertexNormals: true,
    maxZoom: 18,
  });
  view.addLayer({
    type: "terrain",
    source: terrainSource,
    terrain: {
      castShadow: true,
      receiveShadow: true,
      skirt: false,
    },
  });

  const photoSource = view.addSource({
    type: "raster-tile",
    url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
    maxZoom: 18,
  });
  view.addLayer({
    type: "raster",
    source: photoSource,
  });

  const buildingSource = view.addSource({
    type: "3d-tiles",
    url: "https://assets.cms.plateau.reearth.io/assets/c1/28f9ff-e9d0-44df-b092-88ac7ebdfa42/tngw_4gaiku/tileset.json",
  });
  view.addLayer({
    type: "3d-tiles",
    source: buildingSource,
    model: {
      show: true,
      castShadow: true,
      receiveShadow: true,
    },
  });

  personView.start();
} else {
  const plugin = new DefaultPlugin();
  const view = new ThreeView<DefaultDescriptions>({
    shadow: true,
    animation: true,
  });
  view.addPlugin(plugin);
  await view.init();

  const layers = plugin.addDefaultPhotorealScene();

  layers.aerialPerspective.update({
    aerialPerspective: {
      irradiance: true,
    },
  });

  view.lit = false;

  const photoSource = view.addSource({
    type: "raster-tile",
    url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
    maxZoom: 18,
  });
  view.addLayer({
    type: "raster",
    source: photoSource,
  });

  const terrainSource = view.addSource({
    type: "quantized-mesh",
    url: "https://terrain.reearth.land/cesium-mesh/ellipsoid/{z}/{x}/{y}.terrain",
    requestVertexNormals: true,
    requestWaterMask: true,
    maxZoom: 18,
  });
  view.addLayer({
    type: "terrain",
    source: terrainSource,
    terrain: {
      castShadow: true,
      receiveShadow: true,
    },
  });

  layers.sun.update({ sun: { castShadow: true } });

  view.toneMappingExposure = exposure(6);

  const clouds = view.addEffect<CloudsEffectDesc>({
    clouds: {
      qualityPreset: "high",
      lightShafts: true,
    },
  });
  clouds.update({ clouds: { shadows: true } });

  view.atmosphere.date = new Date("2026-06-22T08:00:00+09:00");
  view.setCamera(
    camera({
      lng: 139.7511,
      lat: 35.6736,
      height: 4200,
      heading: -100,
      pitch: -22,
    }),
  );

  if (MODE === "rain" || MODE === "snow") {
    if (MODE === "rain") {
      view.addMesh<RainMeshDesc>({
        rain: {
          particleCount: 5000,
          speed: 0.0015,
          opacity: 1.0,
          width: 3,
          height: 60.0,
          areaWidth: 500,
          areaHeight: 1000,
          maxHeight: 10000,
        },
      });
      view.addEffect<RainDropEffectDesc>({
        rainDrop: {
          opacity: 0.8,
          dropGridSize: 12,
          dropDensity: 0.7,
          dropSizeFactor: 0.018,
        },
      });
    } else {
      view.addMesh<SnowMeshDesc>({
        snow: {
          particleCount: 10000,
          speed: 0.00005,
          size: 20,
          opacity: 1,
          areaWidth: 400,
          areaHeight: 800,
          maxHeight: 3000,
          movementStrength: { x: 50, y: 20, z: 50 },
          movementSpeed: { x: 0.0005, y: 0.0002, z: 0.0005 },
        },
      });
    }

    view.setCamera(
      camera({
        lng: 139.7511,
        lat: 35.6736,
        height: 700,
        heading: -100,
        pitch: 3,
      }),
    );
  }

  if (MODE === "water") {
    view.atmosphere.date = new Date("2026-01-01T16:15:00+09:00");
    view.toneMappingExposure = exposure(12);
    view.setCamera(
      camera({
        lng: 139.88,
        lat: 35.42,
        height: 2800,
        heading: 250,
        pitch: -16,
      }),
    );
  }

  if (MODE === "ssr") {
    const plateauSource = view.addSource({
      type: "3d-tiles",
      url: "https://assets.cms.plateau.reearth.io/assets/4c/f2436a-e2be-40e2-83da-f1781f36e30b/13102_chuo-ku_pref_2023_citygml_1_op_bldg_3dtiles_13102_chuo-ku_lod2_no_texture/tileset.json",
    });
    view.addLayer({
      type: "3d-tiles",
      source: plateauSource,
      model: {
        show: true,
        color: new Color().setStyle("#ffffff"),
        metalness: 0,
        roughness: 0.5,
        castShadow: true,
        receiveShadow: true,
      },
    });

    view.addEffect<SSREffectDesc>({
      ssr: {},
    });

    view.toneMappingExposure = exposure(6);
    view.atmosphere.date = new Date("2026-06-22T08:00:00+09:00");
    view.setCamera(
      camera({
        lng: 139.7868,
        lat: 35.6733,
        height: 68,
        heading: 240,
        pitch: -10,
      }),
    );
  }
}
