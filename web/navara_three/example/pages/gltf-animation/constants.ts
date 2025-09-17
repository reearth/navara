// Constants for GLTF Animation example

export const tileUrls = {
  openstreetmap: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  gsiStd: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
  gsiSeamlessphoto:
    "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
};

// Model coordinates
export const SAPPORO_COORDINATES = {
  latitude: 43.0618,
  longitude: 141.3545,
  altitude: 0,
};

export const TOKYO_STATION_COORDINATES = {
  latitude: 35.6812,
  longitude: 139.7671,
};

// Model configuration
export const MODEL_CONFIG = {
  url: "/glTF/Soldier/Soldier.glb",
  scale: { x: 300000, y: 300000, z: 300000 },
  size: 300000,
};
