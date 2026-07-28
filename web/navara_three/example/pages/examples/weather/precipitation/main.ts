import ThreeView, { degreeToRadian, geodeticToVector3 } from "@navaramap/three";
import type {
  CloudsEffectDesc,
  RainMeshDesc,
  SnowMeshDesc,
} from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { Vector2 } from "three";

import { addButton } from "../../../../helpers/button";
import { initializeExample } from "../../../../helpers/initialize";
import { GOOGLE_MAPS_API_KEY } from "../../../../helpers/keys";

const STAGE = { lng: 139.6867, lat: 35.7153 };

const STORM_CLOUDS = {
  qualityPreset: "high" as const,
  coverage: 0.4,
  absorptionCoefficient: 5,
  scatteringCoefficient: 1.0,
  skyLightScale: 1,
  groundBounceScale: 1.0,
  lightShafts: true,
  shadows: true,
  haze: true,
  hazeDensityScale: -4.5,
  hazeExponent: -3.0,
  hazeAbsorptionCoefficient: 0.5,
  localWeatherVelocity: new Vector2(0),
  localWeatherOffset: new Vector2(0.6, -0.3),
};

const view = new ThreeView<DefaultDescriptions>({ animation: true });

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);

await view.init();

const scene = defaultPlugin.addDefaultPhotorealScene();
scene.aerialPerspective.update({
  aerialPerspective: {
    sun: true,
    sky: true,
    irradiance: true,
    albedoScale: 0.5,
  },
});
scene.sky.delete();
view.toneMappingExposure = 60;

view.setCamera({
  lng: STAGE.lng,
  lat: STAGE.lat,
  height: 733.9,
  heading: 162.2,
  pitch: -10.8,
  roll: 0,
});
view.camera.fov = 18.4;

const tilesSource = view.addSource({
  type: "3d-tiles",
  url: `https://tile.googleapis.com/v1/3dtiles/root.json?key=${encodeURIComponent(
    GOOGLE_MAPS_API_KEY,
  )}`,
});
const tiles = view.addLayer({
  type: "3d-tiles",
  source: tilesSource,
  model: { maxSse: 40, normals: true },
});

view.atmosphere.date = new Date("2025-01-01T07:00:00Z");

view.addEffect<CloudsEffectDesc>({ clouds: STORM_CLOUDS });

const position = geodeticToVector3({
  lat: degreeToRadian(STAGE.lat),
  lng: degreeToRadian(STAGE.lng),
  height: 10,
});
const rain = view.addMesh<RainMeshDesc>({ position, rain: {} });
const snow = view.addMesh<SnowMeshDesc>({ position, snow: {}, visible: false });

let raining = true;
const weatherButton = addButton("Weather: Rain");
weatherButton.onclick = () => {
  raining = !raining;
  rain.visible = raining;
  snow.visible = !raining;
  weatherButton.textContent = raining ? "Weather: Rain" : "Weather: Snow";
};

view.attribution?.add([
  {
    attribution: "Google Maps Photorealistic 3D Tiles",
    attributionUrl: "https://www.google.com/permissions/geoguidelines/",
    logo: "/credits/GoogleMaps.png",
    creditLayerId: tiles.id,
  },
]);

initializeExample(view);
