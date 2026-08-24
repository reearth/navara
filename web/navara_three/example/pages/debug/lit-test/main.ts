import ThreeView, { Color } from "@navaramap/three";
import type {
  CloudsEffectDesc,
  SSREffectDesc,
} from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";

const q = new URLSearchParams(location.search);
const lit = q.get("lit") === "1";
const MODE = q.get("m") ?? "ssr";
const EXPOSURE = Number(q.get("exp") ?? "6");

const plugin = new DefaultPlugin();
const view = new ThreeView<DefaultDescriptions>({ shadow: true });
view.addPlugin(plugin);
await view.init();

const layers = plugin.addDefaultPhotorealScene();
layers.aerialPerspective.update({ aerialPerspective: { irradiance: true } });
layers.sun.update({ sun: { castShadow: true } });
view.lit = lit;

const photoSource = view.addSource({
  type: "raster-tile",
  url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
  maxZoom: 18,
});
view.addLayer({ type: "raster", source: photoSource });

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
  terrain: { castShadow: true, receiveShadow: true },
});

const clouds = view.addEffect<CloudsEffectDesc>({
  clouds: { qualityPreset: "high", lightShafts: true },
});
clouds.update({ clouds: { shadows: true } });

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
  view.addEffect<SSREffectDesc>({ ssr: {} });
  view.atmosphere.date = new Date("2026-06-22T08:00:00+09:00");
  view.setCamera({
    lng: 139.7868,
    lat: 35.6733,
    height: 68,
    heading: 240,
    pitch: -10,
    roll: 0,
  });
} else if (MODE === "water") {
  view.atmosphere.date = new Date("2026-01-01T16:00:00+09:00");
  view.setCamera({
    lng: 139.98,
    lat: 35.6,
    height: 1200,
    heading: 236,
    pitch: -5,
    roll: 0,
  });
} else {
  // cloud-shadow check: high noon over the city, shadows should patch the ground
  view.atmosphere.date = new Date("2026-06-22T12:00:00+09:00");
  view.setCamera({
    lng: 139.7511,
    lat: 35.6736,
    height: 4200,
    heading: -100,
    pitch: -22,
    roll: 0,
  });
}

view.toneMappingExposure = EXPOSURE;
