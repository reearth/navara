import ThreeView, {
  degreeToRadian,
  geodeticSurfaceNormal,
  geodeticToVector3,
} from "@navaramap/three";
import type { GLTFModelDesc } from "@navaramap/three_default_descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three_default_plugin";
import { TileJsonPlugin } from "@navaramap/three_plugins";
import { Euler, Quaternion, Vector3 } from "three";

// A point on the Nagano Expressway (E19) mountain stretch near the Shiojiri
// pass (lng/lat in degrees, height in meters), and the road's bearing there
// (degrees clockwise from north) so the car can be aligned with the lane.
const CAR = { lng: 138.036142, lat: 36.085621, height: 1 };
const ROAD_BEARING = 321;

const view = new ThreeView<DefaultDescriptions>();

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);
const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

await view.init();

// Fixed afternoon sun + ambient fill so the body paint reads on the dark map.
view.atmosphere.date = new Date("2026-07-16T03:00:00Z");
view.addLight({ ambient: { intensity: 1.2 } });
view.addLight({ sun: { intensity: 2 } });

// `distance` sets the camera back from the target along its forward ray, so
// the car sits at the view center; a shallow pitch gives the oblique view.
view.setCamera({
  lng: CAR.lng,
  lat: CAR.lat,
  distance: 30,
  heading: ROAD_BEARING - 60,
  pitch: -35,
  roll: 0,
});

const basemap = await tilejson.addSource({
  type: "raster-tile",
  url: "https://papers.reearth.land/styles/black/tilejson.json",
});
view.addLayer({ type: "raster", source: basemap });

// The GLTF model layer renders relative-to-eye and ignores matrixWorld, so
// place it with an ECEF position, and align its up axis with the surface
// normal so it stands upright at the coordinate.
const carGeodetic = {
  lng: degreeToRadian(CAR.lng),
  lat: degreeToRadian(CAR.lat),
  height: CAR.height,
};
const position = geodeticToVector3(carGeodetic);
// Align up with the surface normal, then yaw the model around its own up axis
// to point it down the road.
const rotation = new Euler().setFromQuaternion(
  new Quaternion()
    .setFromUnitVectors(
      new Vector3(0, 1, 0),
      geodeticSurfaceNormal(carGeodetic),
    )
    .multiply(
      new Quaternion().setFromAxisAngle(
        new Vector3(0, 1, 0),
        Math.PI - degreeToRadian(ROAD_BEARING),
      ),
    ),
);

view.addMesh<GLTFModelDesc>({
  gltfModel: { url: "/glTF/car/scene.gltf" },
  position: { x: position.x, y: position.y, z: position.z },
  rotation: { x: rotation.x, y: rotation.y, z: rotation.z },
  scale: { x: 1.0, y: 1.0, z: 1.0 },
});

view.attribution?.add([
  {
    attribution: "Classic Muscle car by Lexyc16 (CC BY 4.0)",
    attributionUrl:
      "https://sketchfab.com/3d-models/classic-muscle-car-641efc889e5f4543bae51d0922e6f4b3",
  },
]);
