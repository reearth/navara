import { describe, it, expect } from "vitest";
import { updatePaddingEdge, replicateEdgesToPadding } from "./hillshade";

/**
 * Helper to create a test texture with unique RGBA values per pixel
 * R channel = x coordinate
 * G channel = y coordinate
 * B channel = x + y
 * A channel = 255
 */
function createTestTexture(size: number): Uint8Array {
  const buffer = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      buffer[idx] = x; // R
      buffer[idx + 1] = y; // G
      buffer[idx + 2] = (x + y) % 256; // B
      buffer[idx + 3] = 255; // A
    }
  }
  return buffer;
}

/**
 * Helper to get pixel RGBA values from texture
 */
function getPixel(
  buffer: Uint8Array,
  x: number,
  y: number,
  width: number,
): [number, number, number, number] {
  const idx = (y * width + x) * 4;
  return [buffer[idx], buffer[idx + 1], buffer[idx + 2], buffer[idx + 3]];
}

describe("replicateEdgesToPadding", () => {
  it("replicates edges for a 4×4 content texture (6×6 padded)", () => {
    const contentSize = 4;
    const paddedSize = contentSize + 2;
    const paddedBytes = new Uint8Array(paddedSize * paddedSize * 4);

    // Fill center with test pattern
    const testContent = createTestTexture(contentSize);
    for (let y = 0; y < contentSize; y++) {
      for (let x = 0; x < contentSize; x++) {
        const srcIdx = (y * contentSize + x) * 4;
        const dstIdx = ((y + 1) * paddedSize + (x + 1)) * 4;
        paddedBytes[dstIdx] = testContent[srcIdx];
        paddedBytes[dstIdx + 1] = testContent[srcIdx + 1];
        paddedBytes[dstIdx + 2] = testContent[srcIdx + 2];
        paddedBytes[dstIdx + 3] = testContent[srcIdx + 3];
      }
    }

    replicateEdgesToPadding(paddedBytes, paddedSize);

    // Verify top padding (y=0): should match first content row (y=1)
    for (let x = 1; x <= contentSize; x++) {
      const paddingPixel = getPixel(paddedBytes, x, 0, paddedSize);
      const contentPixel = getPixel(paddedBytes, x, 1, paddedSize);
      expect(paddingPixel).toEqual(contentPixel);
    }

    // Verify bottom padding (y=5): should match last content row (y=4)
    for (let x = 1; x <= contentSize; x++) {
      const paddingPixel = getPixel(paddedBytes, x, paddedSize - 1, paddedSize);
      const contentPixel = getPixel(paddedBytes, x, contentSize, paddedSize);
      expect(paddingPixel).toEqual(contentPixel);
    }

    // Verify left padding (x=0): should match first content column (x=1)
    for (let y = 1; y <= contentSize; y++) {
      const paddingPixel = getPixel(paddedBytes, 0, y, paddedSize);
      const contentPixel = getPixel(paddedBytes, 1, y, paddedSize);
      expect(paddingPixel).toEqual(contentPixel);
    }

    // Verify right padding (x=5): should match last content column (x=4)
    for (let y = 1; y <= contentSize; y++) {
      const paddingPixel = getPixel(paddedBytes, paddedSize - 1, y, paddedSize);
      const contentPixel = getPixel(paddedBytes, contentSize, y, paddedSize);
      expect(paddingPixel).toEqual(contentPixel);
    }

    // Verify corners
    const topLeft = getPixel(paddedBytes, 0, 0, paddedSize);
    const topLeftContent = getPixel(paddedBytes, 1, 1, paddedSize);
    expect(topLeft).toEqual(topLeftContent);

    const topRight = getPixel(paddedBytes, paddedSize - 1, 0, paddedSize);
    const topRightContent = getPixel(paddedBytes, contentSize, 1, paddedSize);
    expect(topRight).toEqual(topRightContent);

    const bottomLeft = getPixel(paddedBytes, 0, paddedSize - 1, paddedSize);
    const bottomLeftContent = getPixel(paddedBytes, 1, contentSize, paddedSize);
    expect(bottomLeft).toEqual(bottomLeftContent);

    const bottomRight = getPixel(
      paddedBytes,
      paddedSize - 1,
      paddedSize - 1,
      paddedSize,
    );
    const bottomRightContent = getPixel(
      paddedBytes,
      contentSize,
      contentSize,
      paddedSize,
    );
    expect(bottomRight).toEqual(bottomRightContent);
  });

  it("replicates edges for a 256×256 content texture (258×258 padded)", () => {
    const contentSize = 256;
    const paddedSize = contentSize + 2;
    const paddedBytes = new Uint8Array(paddedSize * paddedSize * 4);

    // Fill center with test pattern
    const testContent = createTestTexture(contentSize);
    for (let y = 0; y < contentSize; y++) {
      for (let x = 0; x < contentSize; x++) {
        const srcIdx = (y * contentSize + x) * 4;
        const dstIdx = ((y + 1) * paddedSize + (x + 1)) * 4;
        paddedBytes[dstIdx] = testContent[srcIdx];
        paddedBytes[dstIdx + 1] = testContent[srcIdx + 1];
        paddedBytes[dstIdx + 2] = testContent[srcIdx + 2];
        paddedBytes[dstIdx + 3] = testContent[srcIdx + 3];
      }
    }

    replicateEdgesToPadding(paddedBytes, paddedSize);

    // Sample check: verify a few pixels on each edge
    // Top edge (y=0, x=128) should match (y=1, x=128)
    expect(getPixel(paddedBytes, 128, 0, paddedSize)).toEqual(
      getPixel(paddedBytes, 128, 1, paddedSize),
    );

    // Bottom edge (y=257, x=128) should match (y=256, x=128)
    expect(getPixel(paddedBytes, 128, 257, paddedSize)).toEqual(
      getPixel(paddedBytes, 128, 256, paddedSize),
    );

    // Left edge (x=0, y=128) should match (x=1, y=128)
    expect(getPixel(paddedBytes, 0, 128, paddedSize)).toEqual(
      getPixel(paddedBytes, 1, 128, paddedSize),
    );

    // Right edge (x=257, y=128) should match (x=256, y=128)
    expect(getPixel(paddedBytes, 257, 128, paddedSize)).toEqual(
      getPixel(paddedBytes, 256, 128, paddedSize),
    );
  });
});

describe("updatePaddingEdge", () => {
  const contentSize = 4;
  const paddedSize = contentSize + 2; // 6×6

  function createPaddedTexture(): Uint8Array {
    const paddedBytes = new Uint8Array(paddedSize * paddedSize * 4);
    const testContent = createTestTexture(contentSize);

    // Fill center
    for (let y = 0; y < contentSize; y++) {
      for (let x = 0; x < contentSize; x++) {
        const srcIdx = (y * contentSize + x) * 4;
        const dstIdx = ((y + 1) * paddedSize + (x + 1)) * 4;
        paddedBytes[dstIdx] = testContent[srcIdx];
        paddedBytes[dstIdx + 1] = testContent[srcIdx + 1];
        paddedBytes[dstIdx + 2] = testContent[srcIdx + 2];
        paddedBytes[dstIdx + 3] = testContent[srcIdx + 3];
      }
    }

    replicateEdgesToPadding(paddedBytes, paddedSize);
    return paddedBytes;
  }

  function createEdgeData(
    direction: "left" | "right" | "top" | "bottom",
  ): Uint8Array {
    const edgeBytes = new Uint8Array(contentSize * 4);
    for (let i = 0; i < contentSize; i++) {
      const idx = i * 4;
      // Use unique values to verify correct placement
      switch (direction) {
        case "left":
          edgeBytes[idx] = 100 + i; // R
          edgeBytes[idx + 1] = i; // G
          break;
        case "right":
          edgeBytes[idx] = 200 + i; // R
          edgeBytes[idx + 1] = i; // G
          break;
        case "top":
          edgeBytes[idx] = i; // R
          edgeBytes[idx + 1] = 100 + i; // G
          break;
        case "bottom":
          edgeBytes[idx] = i; // R
          edgeBytes[idx + 1] = 200 + i; // G
          break;
      }
      edgeBytes[idx + 2] = 50; // B (constant)
      edgeBytes[idx + 3] = 255; // A
    }
    return edgeBytes;
  }

  it("updates left padding (direction=0, x=0)", () => {
    const textureData = createPaddedTexture();
    const edgeBytes = createEdgeData("left");

    updatePaddingEdge(textureData, edgeBytes, paddedSize, 0);

    // Verify left padding column (x=0, y=1..4)
    for (let y = 0; y < contentSize; y++) {
      const pixel = getPixel(textureData, 0, y + 1, paddedSize);
      expect(pixel[0]).toBe(100 + y); // R
      expect(pixel[1]).toBe(y); // G
      expect(pixel[2]).toBe(50); // B
      expect(pixel[3]).toBe(255); // A
    }
  });

  it("updates right padding (direction=1, x=paddedSize-1)", () => {
    const textureData = createPaddedTexture();
    const edgeBytes = createEdgeData("right");

    updatePaddingEdge(textureData, edgeBytes, paddedSize, 1);

    // Verify right padding column (x=5, y=1..4)
    for (let y = 0; y < contentSize; y++) {
      const pixel = getPixel(textureData, paddedSize - 1, y + 1, paddedSize);
      expect(pixel[0]).toBe(200 + y); // R
      expect(pixel[1]).toBe(y); // G
      expect(pixel[2]).toBe(50); // B
      expect(pixel[3]).toBe(255); // A
    }
  });

  it("updates top padding (direction=2, y=0)", () => {
    const textureData = createPaddedTexture();
    const edgeBytes = createEdgeData("top");

    updatePaddingEdge(textureData, edgeBytes, paddedSize, 2);

    // Verify top padding row (y=0, x=1..4)
    for (let x = 0; x < contentSize; x++) {
      const pixel = getPixel(textureData, x + 1, 0, paddedSize);
      expect(pixel[0]).toBe(x); // R
      expect(pixel[1]).toBe(100 + x); // G
      expect(pixel[2]).toBe(50); // B
      expect(pixel[3]).toBe(255); // A
    }
  });

  it("updates bottom padding (direction=3, y=paddedSize-1)", () => {
    const textureData = createPaddedTexture();
    const edgeBytes = createEdgeData("bottom");

    updatePaddingEdge(textureData, edgeBytes, paddedSize, 3);

    // Verify bottom padding row (y=5, x=1..4)
    for (let x = 0; x < contentSize; x++) {
      const pixel = getPixel(textureData, x + 1, paddedSize - 1, paddedSize);
      expect(pixel[0]).toBe(x); // R
      expect(pixel[1]).toBe(200 + x); // G
      expect(pixel[2]).toBe(50); // B
      expect(pixel[3]).toBe(255); // A
    }
  });

  it("does not modify content area when updating padding", () => {
    const textureData = createPaddedTexture();
    const edgeBytes = createEdgeData("left");

    // Capture content before update
    const contentBefore = new Uint8Array(contentSize * contentSize * 4);
    for (let y = 0; y < contentSize; y++) {
      for (let x = 0; x < contentSize; x++) {
        const srcIdx = ((y + 1) * paddedSize + (x + 1)) * 4;
        const dstIdx = (y * contentSize + x) * 4;
        contentBefore[dstIdx] = textureData[srcIdx];
        contentBefore[dstIdx + 1] = textureData[srcIdx + 1];
        contentBefore[dstIdx + 2] = textureData[srcIdx + 2];
        contentBefore[dstIdx + 3] = textureData[srcIdx + 3];
      }
    }

    updatePaddingEdge(textureData, edgeBytes, paddedSize, 0);

    // Verify content is unchanged
    for (let y = 0; y < contentSize; y++) {
      for (let x = 0; x < contentSize; x++) {
        const srcIdx = ((y + 1) * paddedSize + (x + 1)) * 4;
        const dstIdx = (y * contentSize + x) * 4;
        expect(textureData[srcIdx]).toBe(contentBefore[dstIdx]);
        expect(textureData[srcIdx + 1]).toBe(contentBefore[dstIdx + 1]);
        expect(textureData[srcIdx + 2]).toBe(contentBefore[dstIdx + 2]);
        expect(textureData[srcIdx + 3]).toBe(contentBefore[dstIdx + 3]);
      }
    }
  });

  it("handles 256×256 content (258×258 padded)", () => {
    const largeContentSize = 256;
    const largePaddedSize = largeContentSize + 2;
    const textureData = new Uint8Array(largePaddedSize * largePaddedSize * 4);
    const edgeBytes = new Uint8Array(largeContentSize * 4);

    // Fill edge with marker values
    for (let i = 0; i < largeContentSize; i++) {
      edgeBytes[i * 4] = 123; // R
      edgeBytes[i * 4 + 1] = i % 256; // G
      edgeBytes[i * 4 + 2] = 45; // B
      edgeBytes[i * 4 + 3] = 255; // A
    }

    updatePaddingEdge(textureData, edgeBytes, largePaddedSize, 0);

    // Verify left padding (sample a few pixels)
    for (let y = 0; y < largeContentSize; y += 64) {
      const pixel = getPixel(textureData, 0, y + 1, largePaddedSize);
      expect(pixel[0]).toBe(123);
      expect(pixel[1]).toBe(y % 256);
      expect(pixel[2]).toBe(45);
      expect(pixel[3]).toBe(255);
    }
  });
});
