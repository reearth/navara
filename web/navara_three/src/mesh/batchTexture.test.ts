import { Color, MeshBasicMaterial } from "three";
import invariant from "tiny-invariant";
import { describe, expect, test } from "vitest";

import {
  type BatchTextureConfig,
  MAX_BATCH_TEXTURE_WIDTH,
  batchBaseIndex,
  encodeFloatToRGBA,
  getBatchDataTexture,
  initBatchDataTexture,
  initBatchedMaterial,
  updateBatchAttribute,
} from "./batchTexture";

/**
 * Tests for the encodeFloatToRGBA function
 *
 * This function encodes a floating-point number into an RGBA array (4 values between 0-1)
 * by using the IEEE 754 binary representation of the float.
 */

test("encodeFloatToRGBA should encode 0 correctly", () => {
  const result = encodeFloatToRGBA(0);

  // Check result is an array of 4 numbers
  expect(result.length, "result should have 4 components").toBe(4);

  // Check all values are between 0 and 1
  result.forEach((value, index) => {
    expect(
      value,
      `component ${index} should be between 0 and 1`,
    ).toBeGreaterThanOrEqual(0);
    expect(
      value,
      `component ${index} should be between 0 and 1`,
    ).toBeLessThanOrEqual(1);
  });

  // For 0, we expect a specific encoding
  expect(result).toEqual([0, 0, 0, 0]);
});

test("encodeFloatToRGBA should encode positive numbers correctly", () => {
  const testCases = [1, 10, 100, 1000, 100000, 1.5, 3.14159];

  for (const value of testCases) {
    const result = encodeFloatToRGBA(value);

    // Check result is an array of 4 numbers
    expect(result.length, `result for ${value} should have 4 components`).toBe(
      4,
    );

    // Check all values are between 0 and 1
    result.forEach((component, index) => {
      expect(
        component,
        `component ${index} for ${value} should be between 0 and 1`,
      ).toBeGreaterThanOrEqual(0);
      expect(
        component,
        `component ${index} for ${value} should be between 0 and 1`,
      ).toBeLessThanOrEqual(1);
    });

    // Decode the float back and verify it's close to the original
    // This is a more comprehensive test that the encoding works correctly
    const decoded = decodeRGBAToFloat(result);
    expect(
      decoded,
      `decoded value should be close to original ${value}`,
    ).toBeCloseTo(value);
  }
});

test("encodeFloatToRGBA should encode negative numbers correctly", () => {
  const testCases = [-1, -10, -100, -1000, -100000, -1.5, -3.14159];

  for (const value of testCases) {
    const result = encodeFloatToRGBA(value);

    // Check result is an array of 4 numbers
    expect(result.length, `result for ${value} should have 4 components`).toBe(
      4,
    );

    // Check all values are between 0 and 1
    result.forEach((component, index) => {
      expect(
        component,
        `component ${index} for ${value} should be between 0 and 1`,
      ).toBeGreaterThanOrEqual(0);
      expect(
        component,
        `component ${index} for ${value} should be between 0 and 1`,
      ).toBeLessThanOrEqual(1);
    });

    // Decode the float back and verify it's close to the original
    const decoded = decodeRGBAToFloat(result);
    expect(
      decoded,
      `decoded value should be close to original ${value}`,
    ).toBeCloseTo(value);
  }
});

test("encodeFloatToRGBA should handle extreme values", () => {
  const testCases = [
    Number.MAX_VALUE,
    Number.MIN_VALUE,
    Number.EPSILON,
    Number.MAX_SAFE_INTEGER,
    Number.MIN_SAFE_INTEGER,
  ];

  for (const value of testCases) {
    const result = encodeFloatToRGBA(value);

    // Check result is an array of 4 numbers
    expect(result.length, `result for ${value} should have 4 components`).toBe(
      4,
    );

    // Check all values are between 0 and 1
    result.forEach((component, index) => {
      expect(
        component,
        `component ${index} for ${value} should be between 0 and 1`,
      ).toBeGreaterThanOrEqual(0);
      expect(
        component,
        `component ${index} for ${value} should be between 0 and 1`,
      ).toBeLessThanOrEqual(1);
    });

    // For extreme values, we can't always expect exact decoding due to precision limitations,
    // but we can check that the result is a valid encoding (4 numbers between 0-1)
  }
});

/**
 * Helper function to decode RGBA values back to a float
 * This is used to verify the encoding works correctly
 */
function decodeRGBAToFloat(rgba: [number, number, number, number]): number {
  // Convert normalized 0-1 values back to 0-255 bytes
  const bytes = new Uint8Array(4);
  bytes[0] = Math.round(rgba[0] * 255);
  bytes[1] = Math.round(rgba[1] * 255);
  bytes[2] = Math.round(rgba[2] * 255);
  bytes[3] = Math.round(rgba[3] * 255);

  // Create a Float32Array view of the same buffer
  const floatView = new Float32Array(bytes.buffer);

  // Return the float value
  return floatView[0];
}

/**
 * Helper: create a Material and initialize it with batch texture for testing.
 */
function setupBatchMaterial(batchLength: number): {
  material: MeshBasicMaterial;
  config: BatchTextureConfig;
} {
  const config: BatchTextureConfig = {
    rows: ["COLOR_SHOW", "HEIGHT", "EXTRUDED_HEIGHT"],
    batchLength,
  };
  const material = new MeshBasicMaterial();
  initBatchedMaterial(material, config);
  initBatchDataTexture(material, config);
  return { material, config };
}

// ── batchBaseIndex ──────────────────────────────────────────────────────

describe("batchBaseIndex", () => {
  test("maps batchId < texWidth to the first batch-row group", () => {
    // texWidth=4096, rowCount=3, batchId=100, rowIndex=0
    // col=100, batchRow=0, physicalRow=0*3+0=0 → index=(0*4096+100)*4=400
    expect(batchBaseIndex(4096, 3, 100, 0)).toBe(400);
  });

  test("maps different rowIndex within same batch-row group", () => {
    // batchId=100, rowIndex=1 → physicalRow=0*3+1=1 → (1*4096+100)*4
    expect(batchBaseIndex(4096, 3, 100, 1)).toBe((4096 + 100) * 4);
    // batchId=100, rowIndex=2 → physicalRow=0*3+2=2 → (2*4096+100)*4
    expect(batchBaseIndex(4096, 3, 100, 2)).toBe((2 * 4096 + 100) * 4);
  });

  test("wraps batchId to second batch-row group when batchId >= texWidth", () => {
    // batchId=4096, texWidth=4096 → col=0, batchRow=1
    // rowIndex=0 → physicalRow=1*3+0=3 → (3*4096+0)*4
    expect(batchBaseIndex(4096, 3, 4096, 0)).toBe(3 * 4096 * 4);
  });

  test("handles batchId in the middle of second batch-row group", () => {
    // batchId=4200, texWidth=4096 → col=104, batchRow=1
    // rowIndex=0 → physicalRow=3 → (3*4096+104)*4
    expect(batchBaseIndex(4096, 3, 4200, 0)).toBe((3 * 4096 + 104) * 4);
    // rowIndex=2 → physicalRow=5 → (5*4096+104)*4
    expect(batchBaseIndex(4096, 3, 4200, 2)).toBe((5 * 4096 + 104) * 4);
  });

  test("handles large batchId in third+ batch-row group", () => {
    // batchId=10000, texWidth=4096 → col=10000%4096=1808, batchRow=2
    // rowIndex=0 → physicalRow=6 → (6*4096+1808)*4
    expect(batchBaseIndex(4096, 3, 10000, 0)).toBe((6 * 4096 + 1808) * 4);
  });

  test("is equivalent to old 1D formula when batchId < texWidth", () => {
    // Old formula: batchId * 4 + rowIndex * (texWidth * 4)
    // New formula: (rowIndex * texWidth + batchId) * 4  (when batchRow=0)
    // These are the same: batchId*4 + rowIndex*texWidth*4 = (rowIndex*texWidth + batchId)*4
    const texWidth = 4096;
    const rowCount = 3;
    for (const batchId of [0, 1, 100, 2000, 4095]) {
      for (const rowIndex of [0, 1, 2]) {
        const oldIndex = batchId * 4 + rowIndex * texWidth * 4;
        const newIndex = batchBaseIndex(texWidth, rowCount, batchId, rowIndex);
        expect(newIndex).toBe(oldIndex);
      }
    }
  });
});

// ── initBatchDataTexture ────────────────────────────────────────────────

describe("initBatchDataTexture", () => {
  test("creates texture with batchLength as width when <= MAX_BATCH_TEXTURE_WIDTH", () => {
    const { material } = setupBatchMaterial(100);
    const texture = getBatchDataTexture(material);
    invariant(texture);
    expect(texture.image.width).toBe(100);
    expect(texture.image.height).toBe(3); // 1 batch-row * 3 attribute rows
  });

  test("caps texture width at MAX_BATCH_TEXTURE_WIDTH for large batch counts", () => {
    const batchLength = 20000;
    const { material } = setupBatchMaterial(batchLength);
    const texture = getBatchDataTexture(material);
    invariant(texture);
    expect(texture.image.width).toBe(MAX_BATCH_TEXTURE_WIDTH);
    // ceil(20000/4096)=5 batch-row groups, each with 3 attribute rows → 15
    const expectedHeight = Math.ceil(batchLength / MAX_BATCH_TEXTURE_WIDTH) * 3;
    expect(texture.image.height).toBe(expectedHeight);
  });

  test("allocates correct data size for large batch counts", () => {
    const batchLength = 20000;
    const { material } = setupBatchMaterial(batchLength);
    const texture = getBatchDataTexture(material);
    invariant(texture);
    const data = texture.image.data as Float32Array;
    expect(data.length).toBe(
      MAX_BATCH_TEXTURE_WIDTH *
        4 *
        Math.ceil(batchLength / MAX_BATCH_TEXTURE_WIDTH) *
        3,
    );
  });

  test("does not recreate texture on second call", () => {
    const { material, config } = setupBatchMaterial(100);
    const tex1 = getBatchDataTexture(material);
    initBatchDataTexture(material, config);
    const tex2 = getBatchDataTexture(material);
    expect(tex1).toBe(tex2);
  });
});

// ── initBatchedMaterial ─────────────────────────────────────────────────

describe("initBatchedMaterial", () => {
  test("sets BATCHED_TEXTURE_ROW_COUNT define", () => {
    const config: BatchTextureConfig = {
      rows: ["COLOR_SHOW", "HEIGHT", "EXTRUDED_HEIGHT"],
      batchLength: 100,
    };
    const material = new MeshBasicMaterial();
    initBatchedMaterial(material, config);

    expect(material.userData.defines.BATCHED_TEXTURE_ROW_COUNT).toBe("3.0");
  });

  test("sets individual row defines", () => {
    const config: BatchTextureConfig = {
      rows: ["COLOR_SHOW", "HEIGHT"],
      batchLength: 10,
    };
    const material = new MeshBasicMaterial();
    initBatchedMaterial(material, config);

    expect(material.userData.defines.BATCHED_TEXTURE_ROW_COLOR_SHOW).toBe(
      "0.0",
    );
    expect(material.userData.defines.BATCHED_TEXTURE_ROW_HEIGHT).toBe("1.0");
    expect(material.userData.defines.BATCHED_TEXTURE_ROW_COUNT).toBe("2.0");
  });
});

// ── updateBatchAttribute with 2D layout ─────────────────────────────────

describe("updateBatchAttribute with 2D layout", () => {
  test("writes color to correct position for batchId < texWidth", () => {
    const { material } = setupBatchMaterial(100);
    const defaultValues = { color: new Color(1, 1, 1) };

    updateBatchAttribute(material, 5, "color", [0.5, 0.6, 0.7], defaultValues);

    const texture = getBatchDataTexture(material);
    invariant(texture);
    const data = texture.image.data as Float32Array;
    // batchId=5, rowIndex=0 (COLOR_SHOW), texWidth=100
    // physicalRow=0, col=5 → baseIndex=(0*100+5)*4=20
    expect(data[20]).toBeCloseTo(0.5);
    expect(data[21]).toBeCloseTo(0.6);
    expect(data[22]).toBeCloseTo(0.7);
  });

  test("writes color to correct position when batchId exceeds texWidth", () => {
    const batchLength = 10000;
    const { material } = setupBatchMaterial(batchLength);
    const defaultValues = { color: new Color(1, 1, 1) };

    // batchId = 5000 → col=5000%4096=904, batchRow=1
    // rowIndex=0 (COLOR_SHOW), rowCount=3 → physicalRow=1*3+0=3
    // baseIndex = (3*4096+904)*4
    const expectedIndex = (3 * MAX_BATCH_TEXTURE_WIDTH + 904) * 4;

    updateBatchAttribute(
      material,
      5000,
      "color",
      [0.1, 0.2, 0.3],
      defaultValues,
    );

    const texture2 = getBatchDataTexture(material);
    invariant(texture2);
    const data = texture2.image.data as Float32Array;
    expect(data[expectedIndex]).toBeCloseTo(0.1);
    expect(data[expectedIndex + 1]).toBeCloseTo(0.2);
    expect(data[expectedIndex + 2]).toBeCloseTo(0.3);
  });

  test("writes height to correct 2D position for large batchId", () => {
    const batchLength = 10000;
    const { material } = setupBatchMaterial(batchLength);
    const defaultValues = { color: new Color(1, 1, 1) };

    // batchId=5000 → col=904, batchRow=1
    // rowIndex=1 (HEIGHT), rowCount=3 → physicalRow=1*3+1=4
    // baseIndex = (4*4096+904)*4
    const expectedIndex = (4 * MAX_BATCH_TEXTURE_WIDTH + 904) * 4;

    updateBatchAttribute(material, 5000, "height", 42.5, defaultValues);

    const texture = getBatchDataTexture(material);
    invariant(texture);
    const data = texture.image.data as Float32Array;
    // Height is RGBA-encoded, so the 4 floats at expectedIndex should decode to 42.5
    const encoded: [number, number, number, number] = [
      data[expectedIndex],
      data[expectedIndex + 1],
      data[expectedIndex + 2],
      data[expectedIndex + 3],
    ];
    expect(decodeRGBAToFloat(encoded)).toBeCloseTo(42.5);
  });

  test("writes show attribute for batchId in second batch-row group", () => {
    const batchLength = 10000;
    const { material } = setupBatchMaterial(batchLength);
    const defaultValues = { color: new Color(0.8, 0.9, 1.0) };

    // batchId=4096 → col=0, batchRow=1
    // rowIndex=0 (COLOR_SHOW), rowCount=3 → physicalRow=3
    // baseIndex = (3*4096+0)*4
    const expectedIndex = 3 * MAX_BATCH_TEXTURE_WIDTH * 4;

    updateBatchAttribute(material, 4096, "show", false, defaultValues);

    const texture = getBatchDataTexture(material);
    invariant(texture);
    const data = texture.image.data as Float32Array;
    // Alpha channel (show) should be 0
    expect(data[expectedIndex + 3]).toBe(0.0);
    // RGB should have default color since _batchColorTouched is false
    expect(data[expectedIndex]).toBeCloseTo(0.8);
    expect(data[expectedIndex + 1]).toBeCloseTo(0.9);
    expect(data[expectedIndex + 2]).toBeCloseTo(1.0);
  });

  test("multiple batchIds across different batch-row groups do not collide", () => {
    const batchLength = 10000;
    const { material } = setupBatchMaterial(batchLength);
    const defaultValues = { color: new Color(1, 1, 1) };

    // Write distinct colors to batchId 100 (group 0) and 4196 (group 1, col=100)
    updateBatchAttribute(
      material,
      100,
      "color",
      [1.0, 0.0, 0.0],
      defaultValues,
    );
    updateBatchAttribute(
      material,
      4196,
      "color",
      [0.0, 1.0, 0.0],
      defaultValues,
    );

    const texture = getBatchDataTexture(material);
    invariant(texture);
    const data = texture.image.data as Float32Array;

    // batchId=100: col=100, batchRow=0, physicalRow=0 → (0*4096+100)*4=400
    expect(data[400]).toBeCloseTo(1.0);
    expect(data[401]).toBeCloseTo(0.0);
    expect(data[402]).toBeCloseTo(0.0);

    // batchId=4196: col=100, batchRow=1, physicalRow=3 → (3*4096+100)*4
    const idx4196 = (3 * MAX_BATCH_TEXTURE_WIDTH + 100) * 4;
    expect(data[idx4196]).toBeCloseTo(0.0);
    expect(data[idx4196 + 1]).toBeCloseTo(1.0);
    expect(data[idx4196 + 2]).toBeCloseTo(0.0);
  });
});
