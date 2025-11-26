import {
  angleToRadian,
  getPlaneFromPointNormal as nvGetPlaneFromPointNormal,
  getPickRay as nvGetPickRay,
  getRayPlaneIntersection as nvGetRayPlaneIntersection,
  getHeightFromEllipsoid as nvGetHeightFromEllipsoid,
  Vec3,
  Vec2,
  Window,
  Transform,
  CameraFrustum,
  Plane,
  Ray,
} from "@navara/engine-api";
import { Vector3, Vector2, PerspectiveCamera } from "three";

export function getPlaneFromPointNormal(
  point: Vector3,
  normal: Vector3,
): Plane {
  const pointVec3 = new Vec3(point.x, point.y, point.z);
  const normalVec3 = new Vec3(normal.x, normal.y, normal.z);

  const result = nvGetPlaneFromPointNormal(pointVec3, normalVec3);
  pointVec3.free();
  normalVec3.free();

  return result;
}

export function getPickRay(
  window: Window,
  camera: PerspectiveCamera,
  vec2: Vector2,
): Ray {
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

  const result = nvGetPickRay(
    window,
    transform,
    frustum,
    new Vec2(vec2.x, vec2.y),
  );

  transform.free();
  frustum.free();

  return result;
}

export function getRayPlaneIntersection(
  ray: Ray,
  plane: Plane,
): Vector3 | undefined {
  const intersection = nvGetRayPlaneIntersection(ray, plane);
  if (intersection) {
    const result = new Vector3(intersection.x, intersection.y, intersection.z);
    intersection.free();
    return result;
  }
  return undefined;
}

export function getHeightFromEllipsoid(point: Vector3): number {
  const vec3 = new Vec3(point.x, point.y, point.z);
  const result = nvGetHeightFromEllipsoid(vec3);
  vec3.free();
  return result;
}
