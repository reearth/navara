import initApi, {
  geodeticToXyz,
  xyzToGeodetic,
  angleToRadian,
  angleToDegree,
  screenToWorld,
  geodeticSurfaceNormal as nvGeodeticSurfaceNormal,
  eastNorthUpToFixedFrame as nvEastNorthUpToFixedFrame,
  northEastDownToFixedFrame as nvNorthEastDownToFixedFrame,
  northUpEastToFixedFrame as nvNorthUpEastToFixedFrame,
  northWestUpToFixedFrame as nvNorthWestUpToFixedFrame,
  LLE,
  Vec3,
  Vec2,
  Window,
  Transform,
  CameraFrustum,
} from "@navara/engine-api";
import { Vector3, Vector2, Matrix4, PerspectiveCamera } from "three";

export { LLE, Transform, CameraFrustum, Window } from "@navara/engine-api";

export async function initNavaraApi() {
  await initApi();
}

export function geodeticToVector3(lle: LLE): Vector3 {
  const pos = geodeticToXyz(lle);
  return new Vector3(pos.x, pos.y, pos.z);
}

export function vector3ToGeodetic(xyz: Vector3): LLE {
  const vec3 = new Vec3(xyz.x, xyz.y, xyz.z);
  return xyzToGeodetic(vec3);
}

export function degreeToRadian(degree: number): number {
  return angleToRadian(degree);
}

export function radianToDegree(radian: number): number {
  return angleToDegree(radian);
}

export function convertScreenToWorld(
  window: Window,
  camera: PerspectiveCamera,
  vec2: Vector2,
): Vector3 | undefined {
  window.width = window.width * window.pixel_ratio;
  window.height = window.height * window.pixel_ratio;

  const transform = new Transform(
    camera.position.x,
    camera.position.y,
    camera.position.z,
    camera.quaternion.x,
    camera.quaternion.y,
    camera.quaternion.z,
    camera.quaternion.w,
    camera.scale.x,
    camera.scale.y,
    camera.scale.z,
  );

  const frustum = new CameraFrustum(
    camera.near,
    camera.far,
    angleToRadian(camera.fov),
    camera.aspect,
  );

  const pos = screenToWorld(
    window,
    transform,
    frustum,
    new Vec2(vec2.x, vec2.y),
  );

  if (!pos) {
    return undefined;
  }
  return new Vector3(pos.x, pos.y, pos.z);
}

export function geodeticSurfaceNormal(lle: LLE): Vector3 {
  const pos = nvGeodeticSurfaceNormal(lle);
  return new Vector3(pos.x, pos.y, pos.z);
}

export function eastNorthUpToFixedFrame(origin: Vector3): Matrix4 {
  const vec3 = new Vec3(origin.x, origin.y, origin.z);
  const arr = nvEastNorthUpToFixedFrame(vec3);
  const matrix = new Matrix4().fromArray(arr);
  return matrix;
}

export function northEastDownToFixedFrame(origin: Vector3): Matrix4 {
  const vec3 = new Vec3(origin.x, origin.y, origin.z);
  const arr = nvNorthEastDownToFixedFrame(vec3);
  const matrix = new Matrix4().fromArray(arr);
  return matrix;
}

export function northUpEastToFixedFrame(origin: Vector3): Matrix4 {
  const vec3 = new Vec3(origin.x, origin.y, origin.z);
  const arr = nvNorthUpEastToFixedFrame(vec3);
  const matrix = new Matrix4().fromArray(arr);
  return matrix;
}

export function northWestUpToFixedFrame(origin: Vector3): Matrix4 {
  const vec3 = new Vec3(origin.x, origin.y, origin.z);
  const arr = nvNorthWestUpToFixedFrame(vec3);
  const matrix = new Matrix4().fromArray(arr);
  return matrix;
}
