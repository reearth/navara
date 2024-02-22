import type { Events, Transform } from "map-engine-prototype";
import type { Camera, Scene } from "three";

export function processEvent(_scene: Scene, camera: Camera, event: Events) {
  if (event.camera_transform_updated) {
    processCameraTransformUpdated(_scene, camera, event.camera_transform_updated);
  }
}

export function processCameraTransformUpdated(_scene: Scene, camera: Camera, transform: Transform) {
  const { tx, ty, tz, qx, qy, qz, qw, sx, sy, sz } = transform;
  camera.position.set(tx, ty, tz);
  camera.quaternion.set(qx, qy, qz, qw);
  camera.scale.set(sx, sy, sz);
}
