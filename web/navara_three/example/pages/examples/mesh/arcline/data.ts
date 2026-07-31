import type { LatLng } from "@navaramap/three";

/** Tokyo's two international gateways, the origin of every arc. */
const HND: LatLng = { lng: 139.7798, lat: 35.5494 };
const NRT: LatLng = { lng: 140.3929, lat: 35.772 };

/** Long-haul destinations reached from Tokyo, spread across every continent. */
const DESTINATIONS: LatLng[] = [
  { lng: 126.4407, lat: 37.4602 }, // ICN Seoul
  { lng: 121.8053, lat: 31.1443 }, // PVG Shanghai
  { lng: 113.9185, lat: 22.308 }, // HKG Hong Kong
  { lng: 100.7501, lat: 13.69 }, // BKK Bangkok
  { lng: 103.994, lat: 1.354 }, // SIN Singapore
  { lng: 77.1, lat: 28.5562 }, // DEL Delhi
  { lng: 55.3644, lat: 25.2528 }, // DXB Dubai
  { lng: 151.1772, lat: -33.9461 }, // SYD Sydney
  { lng: 174.785, lat: -37.0082 }, // AKL Auckland
  { lng: -0.4543, lat: 51.4706 }, // LHR London
  { lng: 2.55, lat: 49.0128 }, // CDG Paris
  { lng: 8.5622, lat: 50.0379 }, // FRA Frankfurt
  { lng: -118.4085, lat: 33.9416 }, // LAX Los Angeles
  { lng: -122.375, lat: 37.6188 }, // SFO San Francisco
  { lng: -73.7781, lat: 40.6413 }, // JFK New York
  { lng: -123.184, lat: 49.1967 }, // YVR Vancouver
  { lng: -99.0721, lat: 19.4363 }, // MEX Mexico City
  { lng: -46.4731, lat: -23.4356 }, // GRU São Paulo
];

// ArcLine geometry is a flat list; each consecutive (origin, target) pair is one arc.
export const flightArcs: LatLng[] = DESTINATIONS.flatMap((dest, i) => [
  i % 2 === 0 ? HND : NRT,
  dest,
]);
