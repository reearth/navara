import { calcCameraPosition, calcModelMatrixRTE } from "@navara/three_api";
import { Camera, Matrix4, Object3D, Vector3 } from "three";

/**
 * Interface for objects that need RTE (Relative-To-Eye) rendering support
 */
export type RTEUserData = {
  modelViewMatrixRTE?: { value: Matrix4 };
  cameraPositionHigh?: { value: Vector3 };
  cameraPositionLow?: { value: Vector3 };
};

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
export function setupRTEMesh(
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
