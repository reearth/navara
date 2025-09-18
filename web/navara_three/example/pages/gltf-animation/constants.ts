/**
 * Constants for GLTF Animation example
 *
 * Contains geographical coordinates and 3D model configuration
 * used in the GLTF animation demonstration.
 */

// Sapporo coordinates as GeoJSON Feature (used for GLTF model)
export const SAPPORO_GEOJSON = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "Point",
    coordinates: [141.3545, 43.0618], // [longitude, latitude]
  },
};

// Tokyo Station coordinates as GeoJSON Feature (used for GeoJSON model)
export const TOKYO_STATION_GEOJSON = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "Point",
    coordinates: [139.7671, 35.6812], // [longitude, latitude]
  },
};

// 3D model configuration
export const MODEL_CONFIG = {
  url: "/glTF/Soldier/Soldier.glb",
  scale: { x: 300000, y: 300000, z: 300000 },
  size: 300000,
};
