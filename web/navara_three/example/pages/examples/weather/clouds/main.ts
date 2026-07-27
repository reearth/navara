import ThreeView, { TERRARIUM_ELEVATION_DECODER } from "@navaramap/three";
import type { CloudsEffectDesc } from "@navaramap/three_default_descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three_default_plugin";
import { Vector2 } from "three";

import { addButton } from "../../../../helpers/button";
import { initializeExample } from "../../../../helpers/initialize";

const STAGE = { lng: 138.634, lat: 35.5 };

const SUNNY_CLOUDS = {
  qualityPreset: "high" as const,
  localWeatherVelocity: new Vector2(0.001, 0),
  lightShafts: true,
  shadows: true,
  haze: true,
  coverage: 0.4,
  scatteringCoefficient: 1.0,
  skyLightScale: 1,
  absorptionCoefficient: 0,
  groundBounceScale: 1.0,
  hazeDensityScale: -4.5,
  hazeExponent: -3.0,
  hazeAbsorptionCoefficient: 0.5,
};

const view = new ThreeView<DefaultDescriptions>({
  animation: true,
  shadow: true,
});

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);

await view.init();

const scene = defaultPlugin.addDefaultPhotorealScene();
scene.aerialPerspective.update({
  aerialPerspective: {
    sun: true,
    sky: true,
    irradiance: true,
    albedoScale: Math.PI,
  },
});
scene.sky.delete();
view.toneMappingExposure = 10;

view.setCamera({
  lng: STAGE.lng,
  lat: STAGE.lat,
  heading: 181,
  pitch: -27,
  distance: 8444,
  roll: 0,
});
view.camera.fov = 75;

const imagery = view.addSource({
  type: "raster-tile",
  url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
  maxZoom: 18,
});
view.addLayer({ type: "raster", source: imagery });

const dem = view.addSource({
  type: "raster-dem",
  url: "https://tiles.mapterhorn.com/{z}/{x}/{y}.webp",
  elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
  maxZoom: 17,
  minZoom: 5,
  tileSize: 512,
});
view.addLayer({
  type: "raster",
  source: dem,
  hillshade: { exaggeration: 0.3 },
});
view.addLayer({
  type: "terrain",
  source: dem,
  terrain: { castShadow: true, receiveShadow: true },
});

view.atmosphere.date = new Date("2025-06-15T08:30:00Z");

const clouds = view.addEffect<CloudsEffectDesc>({ clouds: SUNNY_CLOUDS });

const COVERAGES = [
  { label: "Few", value: 0.25 },
  { label: "Some", value: 0.4 },
  { label: "Many", value: 0.6 },
];
let index = 1;
const coverageButton = addButton(`Coverage: ${COVERAGES[index].label}`);
coverageButton.onclick = () => {
  index = (index + 1) % COVERAGES.length;
  clouds.update({ clouds: { coverage: COVERAGES[index].value } });
  coverageButton.textContent = `Coverage: ${COVERAGES[index].label}`;
};

view.attribution?.add([
  {
    attribution: "© Mapterhorn",
    attributionUrl: "https://mapterhorn.com/attribution",
  },
  {
    attribution:
      "Geospatial Information Authority of Japan Tiles - Latest Nationwide Photo (Seamless)",
    attributionUrl: "https://maps.gsi.go.jp/development/ichiran.html",
  },
]);

initializeExample(view);
