import type { Transform } from "@navara/engine";
import { calcCameraPosition, calcModelMatrixRTE } from "@navara/three_api";
import { Camera, Matrix4, Object3D, Vector3 } from "three";

import { setTransform } from "../event";

/**
 * Interface for objects that need RTE (Relative-To-Eye) rendering support
 */
export type RTEUserData = {
  modelViewMatrixRTE?: { value: Matrix4 };
  cameraPositionHigh?: { value: Vector3 };
  cameraPositionLow?: { value: Vector3 };
}

/**
 * Setup onBeforeRender/onBeforeShadow callback for RTE rendering
 *
 * @param mesh - The mesh object to setup
 * @param userData - RTE user data containing uniforms
 * @param modelMatrix - Optional model matrix for calcModelMatrixRTE.
 *                      - Use identity matrix for GLTF models where world position is in RTE uniforms
 *                      - Use mesh.matrixWorld for objects with actual positions (default)
 * @param cameraPosMatrix - Optional matrix for calcCameraPosition. If not specified, uses modelMatrix.
 *                          - Point/Billboard/Text/Model: use identity matrix (world space camera position)
 *                          - Polygon: use mesh.matrixWorld (same as modelMatrix)
 * @returns A callback function that works for both onBeforeRender and onBeforeShadow
 */
export function setupRTEBeforeRender(
  mesh: Object3D,
  userData: RTEUserData,
  modelMatrix?: Matrix4,
  cameraPosMatrix?: Matrix4,
): (Object3D["onBeforeRender"] & Object3D["onBeforeShadow"]) | null {
  const modelMatrixToUse =
    modelMatrix !== undefined ? modelMatrix : mesh.matrixWorld;
  const cameraPosMatrixToUse =
    cameraPosMatrix !== undefined ? cameraPosMatrix : modelMatrixToUse;

  return (_renderer, _scene, camera, shadowCameraOrGeometry) => {
    if (
      !userData.modelViewMatrixRTE ||
      !userData.cameraPositionHigh ||
      !userData.cameraPositionLow
    ) {
      return;
    }

    // If 4th parameter is a Camera, this is onBeforeShadow, use shadowCamera
    // Otherwise this is onBeforeRender, use camera
    const actualCamera =
      shadowCameraOrGeometry instanceof Camera
        ? shadowCameraOrGeometry
        : camera;

    calcModelMatrixRTE(
      modelMatrixToUse,
      actualCamera.matrixWorldInverse,
      userData.modelViewMatrixRTE.value,
    );

    // Use cameraPosMatrix for camera position calculation
    const result = calcCameraPosition(
      actualCamera.position,
      cameraPosMatrixToUse,
    );
    userData.cameraPositionHigh.value = result.high;
    userData.cameraPositionLow.value = result.low;
  };
}

/**
 * Set position using RTE (Relative-To-Eye) encoding
 *
 * RTE mode stores position in high/low precision uniforms and keeps
 * the mesh at origin (0,0,0). Only scale is applied to control sprite size.
 * Rotation/quaternion would affect matrixWorld and break RTE calculations.
 *
 * @param mesh - The mesh to position (Sprite or Group)
 * @param positionHigh - High precision component array
 * @param positionLow - Low precision component array
 * @param posIdx - Index in the position arrays
 * @param transform - Transform data containing scale
 */
export function setRTEPosition<T extends Object3D>(
  mesh: T,
  positionHigh: Float32Array<ArrayBufferLike> | null | undefined,
  positionLow: Float32Array<ArrayBufferLike> | null | undefined,
  posIdx: number,
  transform: Transform,
): void {
  // RTE: Only set scale (for sprite size), not position/rotation
  // Position is encoded in rtePosHigh/Low (absolute world coordinates)
  // Rotation/quaternion would affect matrixWorld and break RTE calculations
  mesh.scale.set(transform.sx, transform.sy, transform.sz);

  if (
    positionHigh &&
    positionLow &&
    mesh.userData.rtePosHigh &&
    mesh.userData.rtePosLow
  ) {
    // Set high and low components separately - shader will combine
    mesh.userData.rtePosHigh.value.set(
      positionHigh[posIdx],
      positionHigh[posIdx + 1],
      positionHigh[posIdx + 2],
    );
    mesh.userData.rtePosLow.value.set(
      positionLow[posIdx],
      positionLow[posIdx + 1],
      positionLow[posIdx + 2],
    );
  }
}

/**
 * Set position using RTC (Relative-To-Center) encoding
 *
 * RTC mode sets the mesh position/rotation/scale to the tile center transform,
 * and stores the relative offset in a uniform.
 *
 * @param mesh - The mesh to position (Sprite or Group)
 * @param position - Position array (relative to tile center)
 * @param posIdx - Index in the position array
 * @param transform - Transform data (position, rotation, scale)
 */
export function setRTCPosition<T extends Object3D>(
  mesh: T,
  position: Float32Array<ArrayBufferLike> | null | undefined,
  posIdx: number,
  transform: Transform,
): void {
  // RTC: Set mesh position to tile center, store relative offset in uniform
  setTransform(mesh, transform);

  if (position && mesh.userData.rtcPos) {
    mesh.userData.rtcPos.value.set(
      position[posIdx],
      position[posIdx + 1],
      position[posIdx + 2],
    );
  }
}
