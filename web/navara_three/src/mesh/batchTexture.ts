import { DataTexture, FloatType, Material, RGBAFormat } from "three";
import invariant from "tiny-invariant";

export const BATCH_TEXTURE_ROW = [
  "COLOR", // R=colorR, G=colorG, B=colorB, A=NONE
  "HEIGHT", // R,G,B,A=height as RGBA
  "EXTRUDED_HEIGHT", // R,G,B,A=extrudedHeight as RGBA
  "SHOW", // R=show, G=NONE, B=NONE, A=NONE
] as const;

export type BatchTextureRowKey = (typeof BATCH_TEXTURE_ROW)[number];

export type BatchTextureConfig = {
  rows: BatchTextureRowKey[];
  batchLength: number;
};

export const BATCHED_ATTRIBUTE_NAMES = [
  "color", // R=colorR, G=colorG, B=colorB, A=NONE
  "show", // R=show, G=NONE, B=NONE, A=NONE
  "height", // R,G,B,A=Encoded height as RGBA
  "extrudedHeight", // R,G,B,A=Encoded extruded height as RGBA
] as const;

export type BatchedAttributeName = (typeof BATCHED_ATTRIBUTE_NAMES)[number];

export function encodeFloatToRGBA(
  value: number,
): [number, number, number, number] {
  // Encode a float value to RGBA.
  const floatView = new Float32Array(1);
  floatView[0] = value;
  const bytes = new Uint8Array(floatView.buffer);

  // Normalize 0-255 value to 0-1 value.
  return [bytes[0] / 255, bytes[1] / 255, bytes[2] / 255, bytes[3] / 255];
}

/**
 * Set batched texture rows to the material.
 */
export function initBatchedMaterial(
  material: Material,
  config: BatchTextureConfig,
): void {
  material.defines ??= {};

  let idx = 0;
  for (const row of config.rows) {
    const defineKey = `BATCHED_TEXTURE_ROW_${row}`;
    material.defines[defineKey] = idx.toFixed(1);
    idx++;
  }

  material.needsUpdate = true;
}

export function initBatchDataTexture(
  material: Material,
  config: BatchTextureConfig,
): void {
  if (material.userData.batchDataTexture) return;

  const rowCount = config.rows.length;
  const data = new Float32Array(config.batchLength * 4 * rowCount);
  const texture = new DataTexture(
    data,
    config.batchLength,
    rowCount,
    RGBAFormat,
    FloatType,
  );
  texture.needsUpdate = true;

  material.userData.batchDataTexture = { value: texture };
  material.userData.batchTextureConfig = config;

  material.defines ??= {};
  material.defines.USE_BATCH_TEXTURE = true;
  material.needsUpdate = true;
}

export function getRowIndex(
  material: Material,
  row: BatchTextureRowKey,
): number {
  const config = material.userData.batchTextureConfig as
    | BatchTextureConfig
    | undefined;
  invariant(config);

  const rowIndex = config.rows.indexOf(row);
  return rowIndex;
}

export function getBatchDataTexture(
  material: Material,
): DataTexture | undefined {
  return material.userData.batchDataTexture?.value;
}

export function updateBatchAttribute(
  material: Material,
  batchId: number,
  attribute: BatchedAttributeName,
  value: number | number[] | boolean,
): void {
  const texture = getBatchDataTexture(material);
  if (!texture) return;

  const data = texture.image.data as Float32Array;
  const textureWidth = texture.image.width * 4;

  switch (attribute) {
    case "color": {
      if (!(value instanceof Array)) return;
      if (!material.vertexColors) {
        material.vertexColors = true;
        material.needsUpdate = true;
      }

      const rowIndex = getRowIndex(material, "COLOR");

      const baseIndex = batchId * 4 + rowIndex * textureWidth;
      data[baseIndex] = value[0]; // R
      data[baseIndex + 1] = value[1]; // G
      data[baseIndex + 2] = value[2]; // B
      break;
    }
    case "height": {
      if (typeof value !== "number") return;
      if (material.defines) {
        material.defines.USE_BATCH_HEIGHT = true;
        material.needsUpdate = true;
      }

      const rowIndex = getRowIndex(material, "HEIGHT");
      if (rowIndex < 0) return;

      // Encode the height to RGBA
      const encodedHeight = encodeFloatToRGBA(value);

      // Store as RGBA
      const baseIndex = batchId * 4 + rowIndex * textureWidth;
      data[baseIndex] = encodedHeight[0]; // R
      data[baseIndex + 1] = encodedHeight[1]; // G
      data[baseIndex + 2] = encodedHeight[2]; // B
      data[baseIndex + 3] = encodedHeight[3]; // A
      break;
    }
    case "extrudedHeight": {
      if (typeof value !== "number") return;
      if (material.defines) {
        material.defines.USE_BATCH_EXTRUDED_HEIGHT = true;
        material.needsUpdate = true;
      }

      const rowIndex = getRowIndex(material, "EXTRUDED_HEIGHT");
      if (rowIndex < 0) return;

      const encodedHeight = encodeFloatToRGBA(value);

      const baseIndex = batchId * 4 + rowIndex * textureWidth;
      data[baseIndex] = encodedHeight[0]; // R
      data[baseIndex + 1] = encodedHeight[1]; // G
      data[baseIndex + 2] = encodedHeight[2]; // B
      data[baseIndex + 3] = encodedHeight[3]; // A
      break;
    }
    case "show": {
      if (typeof value !== "boolean") return;
      if (material.defines) {
        material.defines.USE_BATCH_SHOW = true;
        material.needsUpdate = true;
      }

      const rowIndex = getRowIndex(material, "SHOW");
      if (rowIndex < 0) return;

      const baseIndex = batchId * 4 + rowIndex * textureWidth;
      data[baseIndex] = value ? 1.0 : 0.0; // R
      // G, B, A are unnecessary
      break;
    }
  }

  texture.needsUpdate = true;
}
