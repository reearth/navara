import { geodeticToVector3 } from "@navaramap/three";
import type { FogLightDefinition } from "@navaramap/three-default-descs";

import { OSM_STREET_LAMPS } from "./street-lamps";

// Night light field for the FogLight scene. The street lamps are real
// `highway=street_lamp` positions from OpenStreetMap (see street-lamps.ts);
// a few brighter accents on Tokyo Station and the Marunouchi / Otemachi tower
// crowns are added by hand so the skyline reads, not just the streets.

type LngLat = [number, number];

const light = (
  [lng, lat]: LngLat,
  height: number,
  color: number,
  intensity: number,
  radius: number,
): FogLightDefinition => {
  const position = geodeticToVector3({
    lat,
    lng,
    height,
  });
  return {
    position: { x: position.x, y: position.y, z: position.z },
    color,
    intensity,
    radius,
  };
};

// Deterministic per-index jitter so identical lamps still vary a little in
// height/power without a random source (captures must be reproducible).
const jitter = (i: number, salt: number): number => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x); // 0..1
};

// Warm sodium street lamp. Real lamps are ~10 m, but they are lifted well off
// the pavement here so each reads as a glowing orb floating above the ground
// instead of being buried in the terrain and pooling into a flat haze.
const streetLamp = (pos: LngLat, i: number): FogLightDefinition =>
  light(pos, 55 + jitter(i, 2) * 20, 0xffb45c, 0.7 + jitter(i, 3) * 0.4, 150);

export const createCityLights = (): FogLightDefinition[] => [
  // Real OpenStreetMap street lamps.
  ...OSM_STREET_LAMPS.map((pos, i) => streetLamp(pos, i)),
  // Tokyo Station facade.
  light([139.7668, 35.6813], 60, 0xffd28a, 2.8, 460),
  light([139.7661, 35.6796], 50, 0xffd28a, 2.8, 460),
  // Lit floors on the Marunouchi / Otemachi towers.
  light([139.7636, 35.6803], 210, 0xffdca0, 2.2, 440), // Marunouchi Bldg
  light([139.764, 35.6817], 230, 0xffdca0, 2.2, 440), // Shin-Marunouchi Bldg
  light([139.7648, 35.679], 220, 0xfff0d0, 2.0, 400), // JP Tower
  light([139.7656, 35.6775], 175, 0xffdca0, 1.8, 380), // Marunouchi Park Bldg
  light([139.763, 35.681], 150, 0xcfe0ff, 1.5, 340), // cool office glow
  light([139.7605, 35.673], 125, 0xffdca0, 1.5, 340), // Yurakucho corner
  light([139.7655, 35.685], 220, 0xffdca0, 2.1, 420), // Otemachi cluster
  light([139.7685, 35.6855], 185, 0xcfe0ff, 1.8, 380),
  light([139.764, 35.6865], 210, 0xffdca0, 2.0, 420),
];
