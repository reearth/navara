import type { LatLngHeight, Window as WindowObject } from "@navara/core";
import initApi, {
  Window,
  LLE,
  Vec3,
  Vec2,
  Transform,
  CameraFrustum,
  geodeticToXyz,
  xyzToGeodetic,
  angleToRadian,
  angleToDegree,
  screenToWorld,
  worldToScreen,
  geodeticSurfaceNormal as nvGeodeticSurfaceNormal,
  eastNorthUpToFixedFrame as nvEastNorthUpToFixedFrame,
  northEastDownToFixedFrame as nvNorthEastDownToFixedFrame,
  northUpEastToFixedFrame as nvNorthUpEastToFixedFrame,
  northWestUpToFixedFrame as nvNorthWestUpToFixedFrame,
  getWGS84SemiMajorAxis as nvGetWGS84SemiMajorAxis,
  getWGS84SemiMinorAxis as nvGetWGS84SemiMinorAxis,
  getWGS84EccentricitySquared as nvGetWGS84EccentricitySquared,
  getWGS84Flattening as nvGetWGS84Flattening,
  getWGS84Eccentricity as nvGetWGS84Eccentricity,
} from "@navara/engine-api";
import { Vector3, Vector2, Matrix4, PerspectiveCamera } from "three";

export type { LatLngHeight, LatLng } from "@navara/core";
export type {
  Window,
  Transform,
  CameraFrustum,
  Plane,
  Ray,
  Vec2,
  Vec3,
} from "@navara/core";

export * from "./intersection";
export * from "./rte";
export * from "./ellipsoidGeodesic";

export async function initNavaraApi() {
  await initApi();
}

export function geodeticToVector3(lle: LatLngHeight): Vector3 {
  const pos = geodeticToXyz(new LLE(lle.lat, lle.lng, lle.height));
  const result = new Vector3(pos.x, pos.y, pos.z);
  pos.free();
  return result;
}

export function vector3ToGeodetic(xyz: Vector3): LatLngHeight {
  const vec3 = new Vec3(xyz.x, xyz.y, xyz.z);
  const lle = xyzToGeodetic(vec3);
  const result = { lat: lle.lat, lng: lle.lng, height: lle.height };
  lle.free();
  return result;
}

export function degreeToRadian(degree: number): number {
  return angleToRadian(degree);
}

export function radianToDegree(radian: number): number {
  return angleToDegree(radian);
}

export function convertScreenToWorld(
  windowObject: WindowObject,
  camera: PerspectiveCamera,
  vec2: Vector2,
): Vector3 | undefined {
  const window = new Window(windowObject.width, windowObject.height, windowObject.pixel_ratio);
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
  const result = new Vector3(pos.x, pos.y, pos.z);
  pos.free();

  return result;
}

export function geodeticSurfaceNormal(lle: LatLngHeight): Vector3 {
  const pos = nvGeodeticSurfaceNormal(new LLE(lle.lat, lle.lng, lle.height));
  const result = new Vector3(pos.x, pos.y, pos.z);
  pos.free();
  return result;
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

export function convertWorldToScreen(
  windowObject: WindowObject,
  camera: PerspectiveCamera,
  worldPos: Vector3,
): Vector2 | undefined {
  const window = new Window(windowObject.width, windowObject.height, windowObject.pixel_ratio);
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

  const screenPos = worldToScreen(
    window,
    transform,
    frustum,
    new Vec3(worldPos.x, worldPos.y, worldPos.z),
  );

  if (!screenPos) {
    return undefined;
  }
  const result = new Vector2(screenPos.x, screenPos.y);
  screenPos.free();

  return result;
}

export function getWGS84SemiMajorAxis(): number {
  return nvGetWGS84SemiMajorAxis();
}

export function getWGS84SemiMinorAxis(): number {
  return nvGetWGS84SemiMinorAxis();
}

export function getWGS84EccentricitySquared(): number {
  return nvGetWGS84EccentricitySquared();
}

export function getWGS84Flattening(): number {
  return nvGetWGS84Flattening();
}

export function getWGS84Eccentricity(): number {
  return nvGetWGS84Eccentricity();
}
