import { encodePosition } from "@navara/engine-api";
import { Matrix4, Vector3 } from "three";

/**
 * Encodes a position into high and low precision Vector3 components for RTE (Relative-To-Eye) rendering.
 * This enables GPU double precision emulation by splitting a position into two float components.
 * @param original - Position to encode
 * @param resultHigh - Vector3 to store the high precision component (reused to avoid GC)
 * @param resultLow - Vector3 to store the low precision component (reused to avoid GC)
 */
export function encodePositionRTE(
  original: Vector3,
  resultHigh = new Vector3(),
  resultLow = new Vector3(),
): { high: Vector3; low: Vector3 } {
  const encoded = encodePosition(original.x, original.y, original.z);
  resultHigh.set(encoded.high.x, encoded.high.y, encoded.high.z);
  resultLow.set(encoded.low.x, encoded.low.y, encoded.low.z);
  encoded.free();
  return { high: resultHigh, low: resultLow };
}

/**
 * Calculates the model-view matrix for Relative-To-Eye (RTE) rendering, which improves precision for distant objects.
 * @param objectMatrixWorld - The object's world transformation matrix
 * @param matrixWorldInverse - The camera's inverse world matrix
 * @param result - Optional matrix to store the result (creates new if omitted)
 * @returns Model-view matrix with translation zeroed for RTE rendering
 */
export const calcModelMatrixRTE = (
  objectMatrixWorld: Matrix4,
  matrixWorldInverse: Matrix4,
  result = new Matrix4(),
) => {
  result.multiplyMatrices(matrixWorldInverse, objectMatrixWorld);
  const e = result.elements;
  e[12] = 0.0;
  e[13] = 0.0;
  e[14] = 0.0; // zero translation
  return result;
};

/**
 * Composes a frame matrix with a local transform, then splits the result into
 * a translation Vector3 and a rotation/scale-only Matrix4 for RTE rendering.
 *
 * The translation is intended to be encoded as high/low RTE uniforms for GPU
 * precision, while the rotation/scale matrix is assigned to the mesh's
 * matrixWorld so it becomes the shader's modelMatrix uniform.
 *
 * @param frameMatrix - The frame transformation matrix (e.g. NUE-to-ECEF)
 * @param localMatrix - The local T*R*S transform to compose within the frame
 * @param resultPosition - Vector3 to store the extracted translation (reused to avoid GC)
 * @param resultRotationScale - Matrix4 to store the translation-zeroed matrix (reused to avoid GC)
 */
export function composeWorldMatrixForRTE(
  frameMatrix: Matrix4,
  localMatrix: Matrix4,
  resultPosition = new Vector3(),
  resultRotationScale = new Matrix4(),
): { position: Vector3; rotationScale: Matrix4 } {
  resultRotationScale.multiplyMatrices(frameMatrix, localMatrix);
  resultPosition.setFromMatrixPosition(resultRotationScale);
  const e = resultRotationScale.elements;
  e[12] = 0;
  e[13] = 0;
  e[14] = 0;
  return { position: resultPosition, rotationScale: resultRotationScale };
}

const INVERSE_MODEL_MATRIX = new Matrix4();
const CAMERA_MODEL_POSITION = new Vector3();
/**
 * Calculates the camera position relative to an object with high/low precision encoding for RTE rendering.
 * @param cameraPosition - The camera's world position
 * @param modelMatrixWorld - The object's world transformation matrix
 * @returns Object with high and low precision Vector3 components for GPU double precision emulation
 */
export const calcCameraPosition = (
  cameraPosition: Vector3,
  modelMatrixWorld: Matrix4,
) => {
  INVERSE_MODEL_MATRIX.copy(modelMatrixWorld).invert();
  CAMERA_MODEL_POSITION.copy(cameraPosition).applyMatrix4(INVERSE_MODEL_MATRIX);
  const encoded = encodePosition(
    CAMERA_MODEL_POSITION.x,
    CAMERA_MODEL_POSITION.y,
    CAMERA_MODEL_POSITION.z,
  );
  const high = encoded.high;
  const low = encoded.low;
  const result = {
    high: new Vector3(high.x, high.y, high.z),
    low: new Vector3(low.x, low.y, low.z),
  };

  encoded.free();

  return result;
};
