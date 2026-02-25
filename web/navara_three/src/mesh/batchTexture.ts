import { Color, DataTexture, FloatType, Material, RGBAFormat } from "three";
import invariant from "tiny-invariant";

export const BATCH_TEXTURE_ROW = [
  "COLOR_SHOW", // R=colorR, G=colorG, B=colorB, A=NONE
  "HEIGHT", // R,G,B,A=height as RGBA
  "EXTRUDED_HEIGHT", // R,G,B,A=extrudedHeight as RGBA
] as const;

export type BatchTextureRowKey = (typeof BATCH_TEXTURE_ROW)[number];

export type BatchTextureConfig = {
  rows: BatchTextureRowKey[];
  batchLength: number;
};

export const BATCHED_ATTRIBUTE_NAMES = [
  "color", // R=colorR, G=colorG, B=colorB, A=show
  "show", // Use alpha channel of color texel.
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

// Maximum batch texture width to stay within WebGL texture size limits (max 16384).
// Using 4096 as a safe default that balances memory layout with broad GPU support.
export const MAX_BATCH_TEXTURE_WIDTH = 4096;

/**
 * Set batched texture rows to the material.
 */
export function initBatchedMaterial(
  material: Material,
  config: BatchTextureConfig,
): void {
  material.userData.defines ??= {};

  let idx = 0;
  for (const row of config.rows) {
    const defineKey = `BATCHED_TEXTURE_ROW_${row}`;
    material.userData.defines[defineKey] = idx.toFixed(1);
    idx++;
  }

  material.userData.defines.BATCHED_TEXTURE_ROW_COUNT =
    config.rows.length.toFixed(1);

  material.needsUpdate = true;
}

/**
 * Allocate the batch data texture for a material.
 *
 * The texture size is fixed at initialization based on `config.batchLength` and
 * is never resized afterwards. Dynamically increasing the batch count is not
 * supported — callers must know the total number of batches up front.
 */
export function initBatchDataTexture(
  material: Material,
  config: BatchTextureConfig,
): void {
  if (material.userData.batchDataTexture) return;

  const rowCount = config.rows.length;
  // Use a 2D texture layout: cap width to avoid exceeding WebGL max texture dimension.
  // Batch IDs are mapped to 2D coordinates: col = batchId % texWidth, row = floor(batchId / texWidth).
  const textureWidth = Math.min(config.batchLength, MAX_BATCH_TEXTURE_WIDTH);
  const batchRows = Math.ceil(config.batchLength / textureWidth);
  const textureHeight = batchRows * rowCount;
  const data = new Float32Array(textureWidth * 4 * textureHeight);
  const texture = new DataTexture(
    data,
    textureWidth,
    textureHeight,
    RGBAFormat,
    FloatType,
  );
  texture.needsUpdate = true;

  material.userData.batchDataTexture = { value: texture };
  material.userData.batchTextureConfig = config;

  material.userData.defines ??= {};
  material.userData.defines.USE_BATCH_TEXTURE = true;
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

export type DefaultBatchAttributeValues = {
  color: Color;
};

/**
 * Compute the flat float-array index for a given batchId and attribute row
 * in the 2D texture layout.
 *
 * Layout: batch IDs are arranged in a grid of width `texWidth`.
 * Each "batch row" (ceil(batchLength / texWidth) groups) occupies `rowCount`
 * physical texture rows (one per attribute row).
 *
 * Physical row = floor(batchId / texWidth) * rowCount + rowIndex
 * Physical col = batchId % texWidth
 * Flat index   = (physicalRow * texWidth + physicalCol) * 4
 */
export function batchBaseIndex(
  texWidth: number,
  rowCount: number,
  batchId: number,
  rowIndex: number,
): number {
  const col = batchId % texWidth;
  const batchRow = Math.floor(batchId / texWidth);
  const physicalRow = batchRow * rowCount + rowIndex;
  return (physicalRow * texWidth + col) * 4;
}

export function updateBatchAttribute(
  material: Material,
  batchId: number,
  attribute: BatchedAttributeName,
  value: number | number[] | boolean,
  defaultValues: DefaultBatchAttributeValues,
): void {
  const texture = getBatchDataTexture(material);
  if (!texture) return;

  const data = texture.image.data as Float32Array;
  const texWidth = texture.image.width;
  const config = material.userData.batchTextureConfig as
    | BatchTextureConfig
    | undefined;
  const rowCount = config?.rows.length ?? BATCH_TEXTURE_ROW.length;

  switch (attribute) {
    case "color": {
      if (!(value instanceof Array)) return;
      if (material.userData.defines) {
        material.vertexColors = true;
        material.userData.defines.USE_BATCH_COLOR_SHOW = true;
        material.needsUpdate = true;

        // When enabling batchTexture color, set material.color to white
        // so that it acts as a multiplier identity (white * any color = that color)
        if ("color" in material) {
          (material.color as Color).setHex(0xffffff);
        }
        if ("uniforms" in material && material.uniforms) {
          const uniforms = material.uniforms as Record<string, any>;
          if (uniforms.color?.value) {
            uniforms.color.value.set(0xffffff);
          }
        }
      }

      material.userData._batchColorTouched = true;

      const rowIndex = getRowIndex(material, "COLOR_SHOW");

      const baseIndex = batchBaseIndex(texWidth, rowCount, batchId, rowIndex);
      data[baseIndex] = value[0]; // R
      data[baseIndex + 1] = value[1]; // G
      data[baseIndex + 2] = value[2]; // B
      if (!material.userData._batchShowTouched) {
        data[baseIndex + 3] = material.visible ? 1 : 0; // A: Default show
      }
      break;
    }
    case "show": {
      if (typeof value !== "boolean") return;
      if (material.userData.defines) {
        material.vertexColors = true;
        material.userData.defines.USE_BATCH_COLOR_SHOW = true;
        material.needsUpdate = true;
      }

      material.userData._batchShowTouched = true;

      // Reuse color texel.
      const rowIndex = getRowIndex(material, "COLOR_SHOW");
      if (rowIndex < 0) return;

      const baseIndex = batchBaseIndex(texWidth, rowCount, batchId, rowIndex);
      if (!material.userData._batchColorTouched) {
        const color = defaultValues.color;
        data[baseIndex] = color.r; // R
        data[baseIndex + 1] = color.g; // G
        data[baseIndex + 2] = color.b; // B
      }
      data[baseIndex + 3] = value ? 1.0 : 0.0; // A
      break;
    }
    case "height": {
      if (typeof value !== "number") return;
      if (material.userData.defines) {
        material.userData.defines.USE_BATCH_HEIGHT = true;
        material.needsUpdate = true;
      }

      const rowIndex = getRowIndex(material, "HEIGHT");
      if (rowIndex < 0) return;

      // Encode the height to RGBA
      const encodedHeight = encodeFloatToRGBA(value);

      // Store as RGBA
      const baseIndex = batchBaseIndex(texWidth, rowCount, batchId, rowIndex);
      data[baseIndex] = encodedHeight[0]; // R
      data[baseIndex + 1] = encodedHeight[1]; // G
      data[baseIndex + 2] = encodedHeight[2]; // B
      data[baseIndex + 3] = encodedHeight[3]; // A
      break;
    }
    case "extrudedHeight": {
      if (typeof value !== "number") return;
      if (material.userData.defines) {
        material.userData.defines.USE_BATCH_EXTRUDED_HEIGHT = true;
        material.needsUpdate = true;
      }

      const rowIndex = getRowIndex(material, "EXTRUDED_HEIGHT");
      if (rowIndex < 0) return;

      const encodedHeight = encodeFloatToRGBA(value);

      const baseIndex = batchBaseIndex(texWidth, rowCount, batchId, rowIndex);
      data[baseIndex] = encodedHeight[0]; // R
      data[baseIndex + 1] = encodedHeight[1]; // G
      data[baseIndex + 2] = encodedHeight[2]; // B
      data[baseIndex + 3] = encodedHeight[3]; // A
      break;
    }
  }

  texture.needsUpdate = true;
}
