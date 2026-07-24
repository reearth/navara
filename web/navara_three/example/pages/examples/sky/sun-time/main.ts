import ThreeView from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three_default_plugin";

import { addButton } from "../../../../helpers/button";
import { initializeExample } from "../../../../helpers/initialize";
import { GOOGLE_MAPS_API_KEY } from "../../../../helpers/keys";
import { addPlayer } from "../../../../helpers/player";

const CITIES = [
  { name: "Tokyo", lng: 139.767, lat: 35.681 },
  { name: "Dubai", lng: 55.274, lat: 25.197 },
  { name: "Paris", lng: 2.295, lat: 48.858 },
  { name: "New York", lng: -73.969, lat: 40.758 },
  { name: "Sydney", lng: 151.207, lat: -33.857 },
];

const DAY_PLAY_MS = 22_500;

const view = new ThreeView<DefaultDescriptions>({ animation: true });

initializeExample(view);

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);

await view.init();

const scene = defaultPlugin.addDefaultPhotorealScene();
scene.aerialPerspective.update({ aerialPerspective: { irradiance: true } });

view.toneMappingExposure = 10;

let current = CITIES[0];
const lookAt = (city: (typeof CITIES)[number]) => {
  view.setCamera({
    lng: city.lng,
    lat: city.lat,
    height: 1600,
    heading: 90,
    pitch: -6,
    roll: 0,
  });
  view.camera.fov = 70;
};
lookAt(current);

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

view.atmosphere.date = new Date("2025-03-20T00:00:00Z");
view.atmosphere.setSolarTime(current, 6.2);

const cityButtons = CITIES.map((city, i) => {
  const button = addButton(city.name);
  button.disabled = i === 0;
  button.onclick = () => {
    // Preserve the current local solar time when moving to the new longitude.
    view.atmosphere.setDateFromCameraAt({ lng: city.lng });
    lookAt(city);
    current = city;
    player.setValue(view.atmosphere.getSolarTime(city));
    cityButtons.forEach((b, j) => (b.disabled = CITIES[j] === city));
  };
  return button;
});

let playing = false;
const player = addPlayer({
  min: 0,
  max: 24,
  step: 1 / 60,
  value: view.atmosphere.getSolarTime(current),
  playing,
  onToggle: (next) => (playing = next),
  onScrub: (hours) => view.atmosphere.setSolarTime(current, hours),
});

let prevTimestamp: number | undefined;
let wasNight = false;
const tick = (timestamp: number) => {
  requestAnimationFrame(tick);

  const night = view.atmosphere.isAtNight(view.camera.positionECEF);
  if (night !== wasNight) {
    scene.stars.update({ stars: { intensity: night ? 40 : 1 } });
    wasNight = night;
  }

  if (playing && prevTimestamp !== undefined) {
    const elapsed = Math.min(timestamp - prevTimestamp, 100);
    view.atmosphere.date = new Date(
      view.atmosphere.date.getTime() + elapsed * (86_400_000 / DAY_PLAY_MS),
    );
    player.setValue(view.atmosphere.getSolarTime(current));
  }
  prevTimestamp = timestamp;
};
requestAnimationFrame(tick);

view.attribution?.add([
  {
    attribution: "Google Maps Photorealistic 3D Tiles",
    attributionUrl: "https://www.google.com/permissions/geoguidelines/",
    logo: "/credits/GoogleMaps.png",
    creditLayerId: tiles.id,
  },
]);
