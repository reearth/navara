import type { FeatureCollection } from "geojson";

/**
 * Major peaks of the Southern Alps around Aoraki / Mount Cook (New Zealand).
 * Plain points with a `name` property — the layer styles them uniformly, so
 * the data stays a minimal, fixed-style GeoJSON.
 */
export const peaks: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    { name: "Aoraki / Mount Cook", lng: 170.1418, lat: -43.595 },
    { name: "Mount Tasman", lng: 170.1553, lat: -43.5657 },
    { name: "Mount Dampier", lng: 170.14, lat: -43.5869 },
    { name: "Mount Sefton", lng: 169.9789, lat: -43.6717 },
    { name: "La Perouse", lng: 170.09, lat: -43.5936 },
    { name: "Malte Brun", lng: 170.2647, lat: -43.5711 },
    { name: "Mount Elie de Beaumont", lng: 170.2842, lat: -43.4767 },
    { name: "The Minarets", lng: 170.2417, lat: -43.5417 },
  ].map(({ name, lng, lat }) => ({
    type: "Feature",
    properties: { name },
    geometry: { type: "Point", coordinates: [lng, lat] },
  })),
};
