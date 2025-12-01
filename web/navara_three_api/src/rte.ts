import { encode_camera } from "@navara/engine-api";
import { Matrix4, Vector3 } from "three";

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

const INVERSE_MODEL_MATRIX = new Matrix4();
const CAMERA_MODEL_POSITION = new Vector3();
export const calcCameraPosition = (
  cameraPosition: Vector3,
  modelMatrixWorld: Matrix4,
) => {
  INVERSE_MODEL_MATRIX.copy(modelMatrixWorld).invert();
  CAMERA_MODEL_POSITION.copy(cameraPosition).applyMatrix4(INVERSE_MODEL_MATRIX);
  const encoded = encode_camera(
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
