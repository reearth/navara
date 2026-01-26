import type { Window as WindowObject } from "@navara/core";
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
  Ray as WASMRay,
} from "@navara/engine-api";
import {
  Vector3,
  Vector2,
  PerspectiveCamera,
  Ray as ThreeRay,
  Plane as ThreePlane,
} from "three";

/**
 * Creates a plane from a point and a normal vector.
 * @param point - A point on the plane
 * @param normal - The normal vector of the plane
 * @returns A Plane object defined by the point and normal
 */
export function getPlaneFromPointNormal(
  point: Vector3,
  normal: Vector3,
): ThreePlane {
  const pointVec3 = new Vec3(point.x, point.y, point.z);
  const normalVec3 = new Vec3(normal.x, normal.y, normal.z);

  const wasmPlane = nvGetPlaneFromPointNormal(pointVec3, normalVec3);

  // Convert WASM Plane to Three.js Plane
  const threeNormal = new Vector3(
    wasmPlane.normal.x,
    wasmPlane.normal.y,
    wasmPlane.normal.z,
  );
  // Three.js Plane uses constant = -distance (dot product of normal and point on plane)
  const threePlane = new ThreePlane(threeNormal, -wasmPlane.distance);

  wasmPlane.free();

  return threePlane;
}

/**
 * Creates a picking ray from screen coordinates for raycasting.
 * @param window - Window configuration with width, height, and pixelRatio
 * @param camera - Three.js PerspectiveCamera
 * @param vec2 - Screen coordinates in CSS pixels (same as MouseEvent clientX/clientY)
 * @returns A Ray starting from the camera through the screen point
 */
export function getPickRay(
  windowObject: WindowObject,
  camera: PerspectiveCamera,
  vec2: Vector2,
): ThreeRay {
  const window = new Window(
    windowObject.width,
    windowObject.height,
    windowObject.pixelRatio,
  );
  window.width = window.width * window.pixelRatio;
  window.height = window.height * window.pixelRatio;

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

  const wasmRay = nvGetPickRay(
    window,
    transform,
    frustum,
    new Vec2(vec2.x, vec2.y),
  );

  // Convert WASM Ray to Three.js Ray
  const origin = new Vector3(
    wasmRay.origin.x,
    wasmRay.origin.y,
    wasmRay.origin.z,
  );
  const direction = new Vector3(
    wasmRay.direction.x,
    wasmRay.direction.y,
    wasmRay.direction.z,
  );
  const threeRay = new ThreeRay(origin, direction);

  wasmRay.free();

  return threeRay;
}

/**
 * Computes the intersection point between a ray and a plane.
 * @param ray - The ray to test
 * @param plane - The plane to intersect with
 * @returns Intersection point Vector3 or undefined if no intersection
 */
export function getRayPlaneIntersection(
  ray: ThreeRay,
  plane: ThreePlane,
): Vector3 | undefined {
  // Convert Three.js Ray to WASM Ray
  const wasmRay = new WASMRay(
    new Vec3(ray.origin.x, ray.origin.y, ray.origin.z),
    new Vec3(ray.direction.x, ray.direction.y, ray.direction.z),
  );

  // Convert Three.js Plane to WASM Plane
  // Three.js uses constant = -distance, so we need to negate it
  const wasmPlane = nvGetPlaneFromPointNormal(
    new Vec3(
      plane.normal.x * -plane.constant,
      plane.normal.y * -plane.constant,
      plane.normal.z * -plane.constant,
    ),
    new Vec3(plane.normal.x, plane.normal.y, plane.normal.z),
  );

  const intersection = nvGetRayPlaneIntersection(wasmRay, wasmPlane);

  wasmRay.free();
  wasmPlane.free();

  if (intersection) {
    const result = new Vector3(intersection.x, intersection.y, intersection.z);
    intersection.free();
    return result;
  }
  return undefined;
}

/**
 * Computes the height of a point above the WGS84 ellipsoid surface.
 * @param point - Position in ECEF coordinates
 * @returns Height above the ellipsoid in meters
 */
export function getHeightFromEllipsoid(point: Vector3): number {
  const vec3 = new Vec3(point.x, point.y, point.z);
  const result = nvGetHeightFromEllipsoid(vec3);
  return result;
}
