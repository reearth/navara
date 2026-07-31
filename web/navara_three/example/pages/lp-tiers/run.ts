import ThreeView, { Color } from "@navaramap/three";
import {
  ToneMappingMode,
  type FogLightEffectDesc,
  type LightProbeDesc,
} from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";
import { SphericalHarmonics3 } from "three";

import { ORANGES_COLOR_MAP } from "../../helpers/colors";
import { TERRAIN_DATASETS, TILES_3D_DATASETS } from "../../helpers/constants";
import { SH_COEFFICIENTS } from "../../helpers/sh";

import { createCityLights } from "./lights";

export type CustomDescriptions = DefaultDescriptions;

// One fixed-camera scene rendered in four independent looks, used to capture
// the landing page's "4 API tiers, 1 engine" stills. `?scene=1..4` picks one:
//   1 declarative style — white-model PLATEAU buildings + terrain, plain light
//   2 plugins           — DefaultPlugin's photoreal atmosphere and sun
//   3 spatial operations — per-feature coloring by height, same plain light
//   4 custom shaders    — the city at night, lit by the FogLight effect
// Intentionally no UI: the page exists to be screenshotted.

// Fixed instants (UTC) so the sun — and therefore the shot — is reproducible.
// The day scenes share low morning light for long shadows; the shadow-free
// scene 3 uses an afternoon sun so the faces the camera sees are the lit ones.
const DAY_DATE = new Date("2026-03-01T23:00:00Z"); // 08:00 JST
const PLAIN_DATE = new Date("2026-03-01T07:00:00Z"); // 16:00 JST
const NIGHT_DATE = new Date("2026-07-27T13:00:00Z"); // 22:00 JST

export const scene = Math.min(
  4,
  Math.max(1, Number(new URLSearchParams(location.search).get("scene")) || 4),
);

// Scenes 1 and 3 share the plain "white model" look: no atmosphere, just an
// ambient fill and a color-only sun over a gray backdrop. Scene 3 drops
// shadows so the height colors read flat; at night the sun sits below the
// horizon and would only cast broken shadow patches, so it is off there too.
const isPlainScene = scene === 1 || scene === 3;
const castsShadows = scene === 1 || scene === 2;

export const run = async (view: ThreeView<CustomDescriptions>) => {
  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);
  const tilejson = new TileJsonPlugin();
  view.addPlugin(tilejson);

  await view.init();

  view.atmosphere.date =
    scene >= 4 ? NIGHT_DATE : scene === 3 ? PLAIN_DATE : DAY_DATE;

  // Fixed across every scene: low over the Babasaki moat looking up the
  // Marunouchi building wall, so towers run unbroken across the frame with
  // the sky above them.
  view.setCamera({
    lng: 139.7546,
    lat: 35.671,
    height: 120.0,
    heading: 42.0,
    pitch: -6.0,
    roll: 0,
  });

  const terrain = view.addSource({
    type: "quantized-mesh",
    url: TERRAIN_DATASETS.reearthQuantizedMesh.url,
    maxZoom: 18,
    minZoom: 2,
    requestVertexNormals: true,
  });
  view.addLayer({
    type: "terrain",
    source: terrain,
    quantizedMesh: {
      receiveShadow: castsShadows,
    },
  });
  // Every scene drapes a paper basemap: black at night so only the fog
  // lights read, white for the day scenes — tinted to the backdrop gray in
  // the plain scenes so ground and sky merge into one stage.
  const basemapSource = await tilejson.addSource({
    type: "raster-tile",
    url:
      scene >= 4
        ? "https://papers.reearth.land/styles/black/tilejson.json"
        : "https://papers.reearth.land/styles/white/tilejson.json",
  });
  view.addLayer({
    type: "raster",
    source: basemapSource,
    ...(isPlainScene
      ? { rasterTile: { color: new Color().setStyle("#9aa2ae") } }
      : {}),
  });

  const buildingLayers = [
    TILES_3D_DATASETS.plateauChiyoda.url,
    TILES_3D_DATASETS.plateauChuo.url,
  ].map((url) =>
    view.addLayer({
      type: "cesium3dtiles",
      data: { url },
      model: {
        show: true,
        // Blue-gray at night so the warm fog lights pop against the towers.
        color: new Color().setStyle(scene >= 4 ? "#5d6884" : "#ffffff"),
        metalness: 0.0,
        roughness: 1.0,
        castShadow: castsShadows,
        receiveShadow: castsShadows,
      },
    }),
  );

  if (isPlainScene) {
    // Plain look (scenes 1 and 3): color-only sun, no shadows, SSAO for
    // depth, neutral tone mapping over the white backdrop.
    view.addLight({ ambient: { intensity: 0.15 } });
    view.addLight({ sun: { intensity: 1, applyColor: true } });
    view.addEffect({ ssao: {} });
    view.addEffect({ toneMapping: { mode: ToneMappingMode.NEUTRAL } });
    view.toneMappingExposure = 4;
  } else {
    // Photoreal look (scenes 2 and 4): DefaultPlugin assembles the sky, sun
    // and sky light in one call; the HDR pipeline needs a raised exposure
    // (see the realistic-atmosphere tutorial).
    const atmosphere = defaultPlugin.addDefaultPhotorealScene();
    atmosphere.sun.update({ sun: { intensity: 2, castShadow: scene === 2 } });
    view.toneMappingExposure = scene >= 4 ? 12 : 5;
    if (scene >= 4) {
      // Night: brighter stars and a mild sky/night ambient so the city stays
      // legible after sunset. Clouds are day-only — at night they would wash
      // the scene with a pale haze.
      atmosphere.stars.update({ stars: { intensity: 150, pointSize: 2.5 } });
      atmosphere.skyLightProbe.update({ skyLightProbe: { intensity: 1.0 } });
      view.addLight<LightProbeDesc>({
        lightProbe: {
          sh: new SphericalHarmonics3().set(SH_COEFFICIENTS.night),
          intensity: 0.05,
        },
      });
    } else {
      view.addEffect({ clouds: { qualityPreset: "high" } });
    }
  }

  // Scene 3 — spatial operations: evaluate every building feature and color
  // it by its measured height (ColorBrewer Oranges).
  if (scene === 3) {
    for (const layer of buildingLayers) {
      layer.on("featureUpdated", ({ evaluator }) => {
        evaluator.evaluate(
          ({ properties }) => {
            const measuredHeight =
              (properties?.["bldg:measuredHeight"] as number) ?? 0;
            const t = Math.max(0, Math.min(1, (measuredHeight - 3) / 232));
            const [r, g, b] = ORANGES_COLOR_MAP.linear(0.3 + t * 0.7);
            return { color: new Color().setRGB(r, g, b) };
          },
          { filters: ["bldg:measuredHeight"] },
        );
      });
    }
  }

  // Scene 4 — custom shaders: the FogLight post effect fills the night air
  // with light scattered from real OpenStreetMap street lamps plus a few
  // hand-placed building/station accents (see lights.ts).
  if (scene >= 4) {
    view.addEffect<FogLightEffectDesc>({
      fogLight: {
        lights: createCityLights(),
        fogDensity: 0.1,
        useSurfaceLighting: true,
        maxFar: view.camera.raw.far,
      },
    });
  }

  // Anti-alias the plain looks — SMAA smooths the aliased building edges so
  // the captured stills stay clean when shown large on the landing page. The
  // photoreal scenes (2 & 4) already run SMAA via addDefaultPhotorealScene.
  if (isPlainScene) {
    view.addEffect({ smaa: {} });
  }

  view.attribution?.add([
    TERRAIN_DATASETS.reearthQuantizedMesh,
    TILES_3D_DATASETS.plateauChiyoda,
    TILES_3D_DATASETS.plateauChuo,
  ]);
};
