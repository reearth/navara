import { expect, test } from "vitest";

import { encodeFloatToRGBA } from "./batchTexture";

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
