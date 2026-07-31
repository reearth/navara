import ThreeView, {
  Color,
  degreeToRadian,
  geodeticSurfaceNormal,
  geodeticToVector3,
} from "@navaramap/three";
import type { GLTFModelDesc } from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";
import { Euler, Quaternion, Vector3 } from "three";

import { initializeExample } from "../../../../helpers/initialize";

const CAR = { lng: 138.036142, lat: 36.085621, height: 1 };
const ROAD_BEARING = 321;

const view = new ThreeView<DefaultDescriptions>({
  backgroundColor: new Color().setStyle("#0f1118"),
});

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);
const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

await view.init();

view.atmosphere.date = new Date("2026-07-16T03:00:00Z");
view.addLight({ ambient: { intensity: 1.2 } });
view.addLight({ sun: { intensity: 2 } });

view.setCamera({
  lng: CAR.lng,
  lat: CAR.lat,
  height: 2,
  distance: 26,
  heading: ROAD_BEARING + 90,
  pitch: -8,
  roll: 0,
});
view.camera.fov = 25;

const basemap = await tilejson.addSource({
  type: "raster-tile",
  url: "https://papers.reearth.land/styles/black/tilejson.json",
});
view.addLayer({ type: "raster", source: basemap });

const carGeodetic = {
  lng: degreeToRadian(CAR.lng),
  lat: degreeToRadian(CAR.lat),
  height: CAR.height,
};
const position = geodeticToVector3(carGeodetic);
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

const car = view.addMesh<GLTFModelDesc>({
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

initializeExample(view, [car]);
