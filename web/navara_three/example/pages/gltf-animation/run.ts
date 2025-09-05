import ThreeView, { type GLTFModelLayer } from "@navara/three";
import { Vector3, Quaternion, Euler } from "three";

import {
  geodeticToVector3,
  degreeToRadian,
  geodeticSurfaceNormal,
  LLE,
} from "@navara/three_api";

const tileUrls = {
  openstreetmap: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  gsiStd: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
  gsiSeamlessphoto:
    "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
};

export const run = async (view: ThreeView) => {
  await view.init();

  view.addDefaultAtmosphereLayers();

  view.addLayer({
    type: "tiles",
    data: { url: tileUrls.openstreetmap },
    raster_tile: {
      max_zoom: 23,
    },
  });

  view.addLayer({
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: {
        coordinates: [
          [138.64270223212833, 35.42793245331515],
          [138.8398612065625, 35.42635304536398],
          [138.64071756664583, 35.33027587314082],
          [138.8449071750585, 35.32671062382879],
        ],
        type: "LineString",
      },
    },
    polyline: {
      color: 0xff0000,
      width: 2,
    },
  });
  
  view.addLayer({
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: {
        coordinates: [
          [
            [138.66861922558115, 35.46838056308519],
            [138.6559918549957, 35.29164005065681],
            [138.81174182884172, 35.279838616806046],
            [138.8071009152797, 35.436389815907134],
            [138.66861922558115, 35.46838056308519],
          ],
        ],
        type: "Polygon",
      },
    },
    polygon: {},
  });

  addTestModelForNormal(view);
};

const addTestModelForNormal = (view: ThreeView) => {
  const pos = geodeticToVector3(
    new LLE(degreeToRadian(43.0618), degreeToRadian(141.3545), 0),
  );
  const normal = geodeticSurfaceNormal(
    new LLE(degreeToRadian(43.0618), degreeToRadian(141.3545), 0),
  );

  // Calculate rotation to align model with surface normal
  const up = new Vector3(0, 1, 0);
  const quaternion = new Quaternion().setFromUnitVectors(up, normal);
  const euler = new Euler().setFromQuaternion(quaternion);

  // Add GLTF model using GLTFModelLayer with URL
  const modelLayer = view.addLayer<GLTFModelLayer>({
    type: "mesh",
    gltfModel: {
      url: "/glTF/Soldier/Soldier.glb",
    },
    scale: { x: 300000, y: 300000, z: 300000 },
    position: { x: pos.x, y: pos.y, z: pos.z },
    rotation: { x: euler.x, y: euler.y, z: euler.z },
  });

  // Add arrow helper
  view.addLayer({
    type: "mesh",
    arrowHelper: {
      direction: normal,
      origin: pos,
      length: 5000000,
      color: 0xffffff,
      headLength: 400000,
      headWidth: 70000,
    },
  });
};
