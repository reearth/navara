import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { FontManager, createSdfAtlasTexture } from "./FontManager";
import type {
  BatchPrepareTextResult,
  FontFamily,
  ShapeTextResult,
} from "./types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  mockReady: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  mockLoadFont: vi
    .fn<() => Promise<{ ok: boolean }>>()
    .mockResolvedValue({ ok: true }),
  mockUnloadFont: vi
    .fn<() => Promise<{ ok: boolean }>>()
    .mockResolvedValue({ ok: true }),
  mockPrepareTextBatch: vi.fn(),
  mockClientDispose: vi.fn(),
  FontWorkerClient: vi.fn(),
}));

vi.mock("./FontWorkerClient", () => ({
  FontWorkerClient: mocks.FontWorkerClient.mockImplementation(function () {
    return {
      ready: mocks.mockReady,
      loadFont: mocks.mockLoadFont,
      unloadFont: mocks.mockUnloadFont,
      prepareTextBatch: mocks.mockPrepareTextBatch,
      dispose: mocks.mockClientDispose,
    };
  }),
}));

vi.mock("three", () => {
  class MockDataTexture {
    image: { data: Uint8Array; width: number; height: number };
    minFilter = 0;
    magFilter = 0;
    generateMipmaps = true;
    needsUpdate = false;
    disposed = false;

    constructor(
      data: Uint8Array,
      width: number,
      height: number,
      _format?: number,
      _type?: number,
    ) {
      this.image = { data, width, height };
    }

    dispose() {
      this.disposed = true;
    }
  }

  return {
    DataTexture: MockDataTexture,
    LinearFilter: 1006,
    RedFormat: 1028,
    UnsignedByteType: 1009,
  };
});

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockConcurrencyManager() {
  return { increment: vi.fn(), decrement: vi.fn() };
}

/** Latin + CJK two-face family. */
function createTestFamily(): FontFamily {
  return {
    family: "TestFamily",
    faces: [
      {
        url: "https://fonts.test/latin.ttf",
        unicodeRanges: [{ from: 0x0000, to: 0x00ff }],
      },
      {
        url: "https://fonts.test/cjk.ttf",
        unicodeRanges: [{ from: 0x4e00, to: 0x9fff }],
      },
    ],
  };
}

function mockFetchSuccess() {
  mockFetch.mockResolvedValue({
    ok: true,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
  });
}

function createShapeResult(text: string, unitsPerEm = 1000): ShapeTextResult {
  return {
    glyphs: [...text].map((_, i) => ({
      glyphId: i + 1,
      fontIndex: 0,
      xAdvance: 500,
      yAdvance: 0,
      xOffset: 0,
      yOffset: 0,
    })),
    metrics: [...text].map((_, i) => ({
      glyphId: i + 1,
      fontIndex: 0,
      atlasX: i * 32,
      atlasY: 0,
      atlasW: 32,
      atlasH: 32,
      bearingX: 0,
      bearingY: 32,
    })),
    unitsPerEm,
  };
}

/** Set the prepareTextBatch mock to return shape results with a given atlasKey. */
function setupBatchMock(atlasKeyOverride?: string) {
  mocks.mockPrepareTextBatch.mockImplementation(
    async (
      fontUrl: string,
      texts: string[],
    ): Promise<BatchPrepareTextResult> => ({
      results: texts.map((text) => ({
        text,
        shapeResult: createShapeResult(text),
      })),
      atlas: {
        data: new Uint8Array([1, 2, 3, 4]),
        width: 256,
        height: 256,
      },
      atlasKey: atlasKeyOverride ?? fontUrl,
    }),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const FONT_URL = "https://fonts.test/test.ttf";
const WORKER_URL = "https://worker.test/font-worker.js";

describe("createSdfAtlasTexture", () => {
  it("should create a DataTexture with correct dimensions and data", () => {
    const data = new Uint8Array([10, 20, 30, 40]);
    const tex = createSdfAtlasTexture(data, 2, 2);

    expect(tex.image.data).toBe(data);
    expect(tex.image.width).toBe(2);
    expect(tex.image.height).toBe(2);
  });

  it("should disable mipmaps and mark as needing update", () => {
    const tex = createSdfAtlasTexture(new Uint8Array(4), 2, 2);

    expect(tex.generateMipmaps).toBe(false);
    expect(tex.needsUpdate).toBe(true);
  });
});

describe("FontManager", () => {
  let manager: FontManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new FontManager(WORKER_URL);
    manager.setConcurrencyManager(createMockConcurrencyManager() as never);
    mockFetchSuccess();
    setupBatchMock();
  });

  afterEach(() => {
    manager.dispose();
  });

  // -----------------------------------------------------------------------
  // Font family registration
  // -----------------------------------------------------------------------

  describe("registerFontFamily", () => {
    it("should register a family that is then recognized by isFamily", () => {
      manager.registerFontFamily(createTestFamily());
      expect(manager.isFamily("TestFamily")).toBe(true);
    });

    it("should allow overwriting a family with the same name", () => {
      manager.registerFontFamily(createTestFamily());
      manager.registerFontFamily({
        family: "TestFamily",
        faces: [
          {
            url: "https://fonts.test/other.ttf",
            unicodeRanges: [{ from: 0, to: 0xffff }],
          },
        ],
      });
      expect(manager.isFamily("TestFamily")).toBe(true);
    });
  });

  describe("unregisterFontFamily", () => {
    it("should remove a registered family", () => {
      manager.registerFontFamily(createTestFamily());
      manager.unregisterFontFamily("TestFamily");
      expect(manager.isFamily("TestFamily")).toBe(false);
    });

    it("should be a no-op for unknown family names", () => {
      expect(() => manager.unregisterFontFamily("Unknown")).not.toThrow();
    });
  });

  describe("isFamily", () => {
    it("should return false for unregistered identifiers", () => {
      expect(manager.isFamily("Nope")).toBe(false);
    });

    it("should return true after registration", () => {
      manager.registerFontFamily(createTestFamily());
      expect(manager.isFamily("TestFamily")).toBe(true);
    });

    it("should return false after unregistration", () => {
      manager.registerFontFamily(createTestFamily());
      manager.unregisterFontFamily("TestFamily");
      expect(manager.isFamily("TestFamily")).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // loadFont
  // -----------------------------------------------------------------------

  describe("loadFont", () => {
    it("should fetch the font file and pass it to the worker", async () => {
      await manager.loadFont(FONT_URL);

      expect(mockFetch).toHaveBeenCalledWith(FONT_URL);
      expect(mocks.mockLoadFont).toHaveBeenCalledWith(
        FONT_URL,
        expect.any(ArrayBuffer),
        undefined,
      );
    });

    it("should forward atlasKey to the worker", async () => {
      await manager.loadFont(FONT_URL, "SharedAtlas");

      expect(mocks.mockLoadFont).toHaveBeenCalledWith(
        FONT_URL,
        expect.any(ArrayBuffer),
        "SharedAtlas",
      );
    });

    it("should skip fetching if the font is already loaded", async () => {
      await manager.loadFont(FONT_URL);
      mockFetch.mockClear();

      await manager.loadFont(FONT_URL);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should deduplicate concurrent requests for the same URL", async () => {
      const p1 = manager.loadFont(FONT_URL);
      const p2 = manager.loadFont(FONT_URL);
      await Promise.all([p1, p2]);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should allow loading different URLs concurrently", async () => {
      const p1 = manager.loadFont("https://fonts.test/a.ttf");
      const p2 = manager.loadFont("https://fonts.test/b.ttf");
      await Promise.all([p1, p2]);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should throw when fetch returns a non-OK response", async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 });

      await expect(manager.loadFont(FONT_URL)).rejects.toThrow(
        "failed to fetch font",
      );
    });

    it("should throw when the worker rejects the font", async () => {
      mocks.mockLoadFont.mockResolvedValueOnce({ ok: false });

      await expect(manager.loadFont(FONT_URL)).rejects.toThrow(
        "WASM failed to load font",
      );
    });

    it("should clean up state on error so a retry can succeed", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      await expect(manager.loadFont(FONT_URL)).rejects.toThrow();

      // Retry should fetch again
      mockFetchSuccess();
      await manager.loadFont(FONT_URL);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // -----------------------------------------------------------------------
  // unloadFont
  // -----------------------------------------------------------------------

  describe("unloadFont", () => {
    it("should tell the worker to unload when ref count reaches 0", async () => {
      await manager.loadFont(FONT_URL);
      await manager.unloadFont(FONT_URL);

      expect(mocks.mockUnloadFont).toHaveBeenCalledWith(FONT_URL);
    });

    it("should only decrement ref count when refs > 1", async () => {
      await manager.loadFont(FONT_URL);
      await manager.loadFont(FONT_URL); // refCount = 2

      await manager.unloadFont(FONT_URL); // refCount → 1

      expect(mocks.mockUnloadFont).not.toHaveBeenCalled();
    });

    it("should fully unload after all refs are released", async () => {
      await manager.loadFont(FONT_URL);
      await manager.loadFont(FONT_URL);

      await manager.unloadFont(FONT_URL);
      await manager.unloadFont(FONT_URL);

      expect(mocks.mockUnloadFont).toHaveBeenCalledTimes(1);
    });

    it("should be a no-op for unknown font URLs", async () => {
      await manager.unloadFont("https://fonts.test/unknown.ttf");
      expect(mocks.mockUnloadFont).not.toHaveBeenCalled();
    });

    it("should dispose the texture when the last font sharing an atlas is unloaded", async () => {
      setupBatchMock("shared");
      await manager.loadFont("https://fonts.test/a.ttf", "shared");

      await manager.prepareText("https://fonts.test/a.ttf", "hi");
      const tex = manager.getAtlasTexture("https://fonts.test/a.ttf");
      expect(tex).not.toBeNull();

      await manager.unloadFont("https://fonts.test/a.ttf");

      expect((tex as Record<string, unknown>).disposed).toBe(true);
    });

    it("should NOT dispose the texture when another font still shares the atlas", async () => {
      setupBatchMock("shared");
      await manager.loadFont("https://fonts.test/a.ttf", "shared");
      await manager.loadFont("https://fonts.test/b.ttf", "shared");

      await manager.prepareText("https://fonts.test/a.ttf", "hi");
      const tex = manager.getAtlasTexture("https://fonts.test/a.ttf");

      await manager.unloadFont("https://fonts.test/a.ttf");

      // b.ttf still references "shared", so texture stays alive
      expect((tex as Record<string, unknown>).disposed).toBe(false);
    });

    it("should clear shape cache for the unloaded font", async () => {
      await manager.loadFont(FONT_URL);
      await manager.prepareText(FONT_URL, "hello");
      expect(manager.isTextPrepared(FONT_URL, "hello")).toBe(true);

      await manager.unloadFont(FONT_URL);

      expect(manager.isTextPrepared(FONT_URL, "hello")).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // prepareText — standalone font
  // -----------------------------------------------------------------------

  describe("prepareText (standalone font)", () => {
    it("should return immediately for empty text without calling worker", async () => {
      await manager.loadFont(FONT_URL);
      await manager.prepareText(FONT_URL, "");

      expect(mocks.mockPrepareTextBatch).not.toHaveBeenCalled();
    });

    it("should shape text via the worker", async () => {
      await manager.loadFont(FONT_URL);
      await manager.prepareText(FONT_URL, "hello");

      expect(mocks.mockPrepareTextBatch).toHaveBeenCalledWith(FONT_URL, [
        "hello",
      ]);
    });

    it("should cache results so repeated calls skip the worker", async () => {
      await manager.loadFont(FONT_URL);
      await manager.prepareText(FONT_URL, "hello");
      mocks.mockPrepareTextBatch.mockClear();

      await manager.prepareText(FONT_URL, "hello");

      expect(mocks.mockPrepareTextBatch).not.toHaveBeenCalled();
    });

    it("should batch multiple synchronous prepareText calls into one worker call", async () => {
      await manager.loadFont(FONT_URL);

      const p1 = manager.prepareText(FONT_URL, "hello");
      const p2 = manager.prepareText(FONT_URL, "world");
      await Promise.all([p1, p2]);

      expect(mocks.mockPrepareTextBatch).toHaveBeenCalledTimes(1);
      expect(mocks.mockPrepareTextBatch).toHaveBeenCalledWith(FONT_URL, [
        "hello",
        "world",
      ]);
    });

    it("should deduplicate concurrent calls for the same text", async () => {
      await manager.loadFont(FONT_URL);

      const p1 = manager.prepareText(FONT_URL, "same");
      const p2 = manager.prepareText(FONT_URL, "same");
      await Promise.all([p1, p2]);

      // Both promises should resolve; only one queue entry expected
      expect(mocks.mockPrepareTextBatch).toHaveBeenCalledTimes(1);
    });

    it("should batch per-font so different fonts get separate worker calls", async () => {
      const urlA = "https://fonts.test/a.ttf";
      const urlB = "https://fonts.test/b.ttf";
      await manager.loadFont(urlA);
      await manager.loadFont(urlB);

      const p1 = manager.prepareText(urlA, "alpha");
      const p2 = manager.prepareText(urlB, "beta");
      await Promise.all([p1, p2]);

      expect(mocks.mockPrepareTextBatch).toHaveBeenCalledTimes(2);
      expect(mocks.mockPrepareTextBatch).toHaveBeenCalledWith(urlA, ["alpha"]);
      expect(mocks.mockPrepareTextBatch).toHaveBeenCalledWith(urlB, ["beta"]);
    });

    it("should store atlas data returned by the worker", async () => {
      await manager.loadFont(FONT_URL);
      await manager.prepareText(FONT_URL, "hello");

      const atlas = manager.getAtlas(FONT_URL);
      expect(atlas).toBeDefined();
      expect(atlas!.width).toBe(256);
      expect(atlas!.height).toBe(256);
    });

    it("should reject when the worker throws during batch processing", async () => {
      await manager.loadFont(FONT_URL);
      mocks.mockPrepareTextBatch.mockRejectedValueOnce(
        new Error("worker crash"),
      );

      await expect(manager.prepareText(FONT_URL, "fail")).rejects.toThrow(
        "worker crash",
      );
    });

    it("should reject all batched entries on worker failure", async () => {
      await manager.loadFont(FONT_URL);
      mocks.mockPrepareTextBatch.mockRejectedValueOnce(
        new Error("batch failed"),
      );

      const p1 = manager.prepareText(FONT_URL, "a");
      const p2 = manager.prepareText(FONT_URL, "b");

      await expect(p1).rejects.toThrow("batch failed");
      await expect(p2).rejects.toThrow("batch failed");
    });
  });

  // -----------------------------------------------------------------------
  // prepareText — font families
  // -----------------------------------------------------------------------

  describe("prepareText (font family)", () => {
    beforeEach(() => {
      manager.registerFontFamily(createTestFamily());
      setupBatchMock("TestFamily");
    });

    it("should lazily load only the face URLs needed for the text", async () => {
      const loadedFaces = new Set<string>();
      // "Hello" is Basic Latin only → should load latin.ttf but NOT cjk.ttf
      await manager.prepareText("TestFamily", "Hello", loadedFaces);

      expect(loadedFaces.has("https://fonts.test/latin.ttf")).toBe(true);
      expect(loadedFaces.has("https://fonts.test/cjk.ttf")).toBe(false);
    });

    it("should load multiple faces when text spans unicode ranges", async () => {
      const loadedFaces = new Set<string>();
      // Mix of Latin (Hi) and CJK (世界)
      await manager.prepareText("TestFamily", "Hi\u4e16\u754c", loadedFaces);

      expect(loadedFaces.has("https://fonts.test/latin.ttf")).toBe(true);
      expect(loadedFaces.has("https://fonts.test/cjk.ttf")).toBe(true);
    });

    it("should not reload a face that is already tracked in loadedFaces", async () => {
      const loadedFaces = new Set<string>();
      await manager.prepareText("TestFamily", "Hello", loadedFaces);
      mockFetch.mockClear();

      await manager.prepareText("TestFamily", "World", loadedFaces);

      // latin.ttf was already in loadedFaces — no new fetch
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should produce a stitched ShapeTextResult for the full text", async () => {
      await manager.prepareText("TestFamily", "Hi\u4e16");

      const result = manager.shapeText("TestFamily", "Hi\u4e16");
      expect(result).toBeDefined();
      expect(result!.glyphs.length).toBeGreaterThan(0);
      expect(result!.unitsPerEm).toBeGreaterThan(0);
    });

    it("should cache the stitched result under the family name", async () => {
      await manager.prepareText("TestFamily", "Hi\u4e16");

      expect(manager.isTextPrepared("TestFamily", "Hi\u4e16")).toBe(true);
    });

    it("should not re-stitch if the same text was already prepared", async () => {
      await manager.prepareText("TestFamily", "Hi\u4e16");
      mocks.mockPrepareTextBatch.mockClear();

      await manager.prepareText("TestFamily", "Hi\u4e16");

      expect(mocks.mockPrepareTextBatch).not.toHaveBeenCalled();
    });

    it("should fall back to the first face for codepoints not in any range", async () => {
      const loadedFaces = new Set<string>();
      // Emoji (U+1F600) is not in any defined range → should fall back to latin.ttf
      await manager.prepareText("TestFamily", "\u{1F600}", loadedFaces);

      expect(loadedFaces.has("https://fonts.test/latin.ttf")).toBe(true);
      expect(loadedFaces.has("https://fonts.test/cjk.ttf")).toBe(false);
    });

    it("should keep spaces with the current face to avoid extra segments", async () => {
      // Family with narrow Latin range (A-z only, no space)
      const family: FontFamily = {
        family: "SpaceTest",
        faces: [
          {
            url: "https://fonts.test/narrow.ttf",
            unicodeRanges: [{ from: 0x41, to: 0x7a }],
          },
          {
            url: "https://fonts.test/fallback.ttf",
            unicodeRanges: [{ from: 0x4e00, to: 0x9fff }],
          },
        ],
      };
      manager.registerFontFamily(family);
      setupBatchMock("SpaceTest");

      const loadedFaces = new Set<string>();
      // "Hello World" — space between Latin words should stay with narrow.ttf
      await manager.prepareText("SpaceTest", "Hello World", loadedFaces);

      expect(loadedFaces.has("https://fonts.test/narrow.ttf")).toBe(true);
      expect(loadedFaces.has("https://fonts.test/fallback.ttf")).toBe(false);
    });

    it("should handle a single-face family without segmentation overhead", async () => {
      const family: FontFamily = {
        family: "SingleFace",
        faces: [
          {
            url: "https://fonts.test/all.ttf",
            unicodeRanges: [{ from: 0, to: 0xffff }],
          },
        ],
      };
      manager.registerFontFamily(family);
      setupBatchMock("SingleFace");

      const loadedFaces = new Set<string>();
      await manager.prepareText(
        "SingleFace",
        "Hello \u4e16\u754c",
        loadedFaces,
      );

      expect(loadedFaces.size).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Stitching with different unitsPerEm
  // -----------------------------------------------------------------------

  describe("stitching with different unitsPerEm", () => {
    it("should normalize glyph advances to the first segment's unitsPerEm", async () => {
      const latinResult = createShapeResult("Hi", 1000);
      const cjkResult = createShapeResult("\u4e16", 2048);

      mocks.mockPrepareTextBatch.mockImplementation(
        async (
          fontUrl: string,
          texts: string[],
        ): Promise<BatchPrepareTextResult> => ({
          results: texts.map((text) => ({
            text,
            shapeResult: fontUrl.includes("cjk") ? cjkResult : latinResult,
          })),
          atlas: { data: new Uint8Array([1]), width: 64, height: 64 },
          atlasKey: "TestFamily",
        }),
      );

      manager.registerFontFamily(createTestFamily());
      await manager.prepareText("TestFamily", "Hi\u4e16");

      const result = manager.shapeText("TestFamily", "Hi\u4e16");
      expect(result).toBeDefined();
      expect(result!.unitsPerEm).toBe(1000);

      // The CJK glyph advance should be scaled by 1000/2048
      const cjkGlyph = result!.glyphs[result!.glyphs.length - 1];
      expect(cjkGlyph.xAdvance).toBeCloseTo(500 * (1000 / 2048));
    });

    it("should not scale when all segments share the same unitsPerEm", async () => {
      mocks.mockPrepareTextBatch.mockImplementation(
        async (
          _fontUrl: string,
          texts: string[],
        ): Promise<BatchPrepareTextResult> => ({
          results: texts.map((text) => ({
            text,
            shapeResult: createShapeResult(text, 1000),
          })),
          atlas: { data: new Uint8Array([1]), width: 64, height: 64 },
          atlasKey: "TestFamily",
        }),
      );

      manager.registerFontFamily(createTestFamily());
      await manager.prepareText("TestFamily", "Hi\u4e16");

      const result = manager.shapeText("TestFamily", "Hi\u4e16");
      // All glyphs should have unscaled xAdvance = 500
      for (const g of result!.glyphs) {
        expect(g.xAdvance).toBe(500);
      }
    });

    it("should deduplicate metrics across segments", async () => {
      // Both segments return a metric with fontIndex:0, glyphId:1
      const sharedMetric = {
        glyphId: 1,
        fontIndex: 0,
        atlasX: 0,
        atlasY: 0,
        atlasW: 32,
        atlasH: 32,
        bearingX: 0,
        bearingY: 32,
      };
      mocks.mockPrepareTextBatch.mockImplementation(
        async (
          _fontUrl: string,
          texts: string[],
        ): Promise<BatchPrepareTextResult> => ({
          results: texts.map((text) => ({
            text,
            shapeResult: {
              glyphs: [
                {
                  glyphId: 1,
                  fontIndex: 0,
                  xAdvance: 500,
                  yAdvance: 0,
                  xOffset: 0,
                  yOffset: 0,
                },
              ],
              metrics: [sharedMetric],
              unitsPerEm: 1000,
            },
          })),
          atlas: { data: new Uint8Array([1]), width: 64, height: 64 },
          atlasKey: "TestFamily",
        }),
      );

      manager.registerFontFamily(createTestFamily());
      await manager.prepareText("TestFamily", "A\u4e16");

      const result = manager.shapeText("TestFamily", "A\u4e16");
      // "0:1" appears in both segments but should only appear once
      expect(result!.metrics.length).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Font family segmentation and stitching (detailed)
  // -----------------------------------------------------------------------

  describe("font family segmentation and stitching", () => {
    const LATIN = "https://fonts.test/latin.ttf";
    const CJK = "https://fonts.test/cjk.ttf";
    const ARABIC = "https://fonts.test/arabic.ttf";

    let batchCalls: { fontUrl: string; texts: string[] }[];

    type FaceConfig = {
      fontIndex: number;
      unitsPerEm: number;
      xAdvance: number;
    };

    /**
     * Tracking mock that records batch calls and returns distinguishable
     * ShapeTextResults per font URL (different fontIndex / xAdvance / unitsPerEm).
     */
    function setupTrackingMock(
      config: Record<string, FaceConfig>,
      atlasKey: string,
    ) {
      batchCalls = [];
      mocks.mockPrepareTextBatch.mockImplementation(
        async (
          fontUrl: string,
          texts: string[],
        ): Promise<BatchPrepareTextResult> => {
          batchCalls.push({ fontUrl, texts });
          const cfg = config[fontUrl] ?? {
            fontIndex: 0,
            unitsPerEm: 1000,
            xAdvance: 500,
          };
          return {
            results: texts.map((text) => ({
              text,
              shapeResult: {
                glyphs: [...text].map((_, i) => ({
                  glyphId: i + 1,
                  fontIndex: cfg.fontIndex,
                  xAdvance: cfg.xAdvance,
                  yAdvance: 10,
                  xOffset: 20,
                  yOffset: 30,
                })),
                metrics: [...text].map((_, i) => ({
                  glyphId: i + 1,
                  fontIndex: cfg.fontIndex,
                  atlasX: i * 32,
                  atlasY: 0,
                  atlasW: 32,
                  atlasH: 32,
                  bearingX: 5,
                  bearingY: 30,
                })),
                unitsPerEm: cfg.unitsPerEm,
              },
            })),
            atlas: { data: new Uint8Array([1]), width: 64, height: 64 },
            atlasKey,
          };
        },
      );
    }

    /** Extract all texts sent to a specific font URL across all batch calls. */
    function textsFor(url: string): string[] {
      return batchCalls
        .filter((c) => c.fontUrl === url)
        .flatMap((c) => c.texts);
    }

    // Standard two-face family (Latin 0x0000-0x00FF, CJK 0x4E00-0x9FFF)
    beforeEach(() => {
      manager.registerFontFamily({
        family: "Seg",
        faces: [
          { url: LATIN, unicodeRanges: [{ from: 0x0000, to: 0x00ff }] },
          { url: CJK, unicodeRanges: [{ from: 0x4e00, to: 0x9fff }] },
        ],
      });
      setupTrackingMock(
        {
          [LATIN]: { fontIndex: 0, unitsPerEm: 1000, xAdvance: 500 },
          [CJK]: { fontIndex: 1, unitsPerEm: 1000, xAdvance: 700 },
        },
        "Seg",
      );
    });

    // ----- segmentation -----

    describe("segmentation", () => {
      it("should produce a single segment for all-Latin text", async () => {
        await manager.prepareText("Seg", "Hello");

        expect(textsFor(LATIN)).toEqual(["Hello"]);
        expect(textsFor(CJK)).toEqual([]);
      });

      it("should produce a single segment for all-CJK text", async () => {
        await manager.prepareText("Seg", "\u4e16\u754c");

        expect(textsFor(CJK)).toEqual(["\u4e16\u754c"]);
        expect(textsFor(LATIN)).toEqual([]);
      });

      it("should split at the boundary between different ranges", async () => {
        // "Hi世界" → "Hi" latin, "世界" cjk
        await manager.prepareText("Seg", "Hi\u4e16\u754c");

        expect(textsFor(LATIN)).toEqual(["Hi"]);
        expect(textsFor(CJK)).toEqual(["\u4e16\u754c"]);
      });

      it("should split in reverse order (CJK then Latin)", async () => {
        await manager.prepareText("Seg", "\u4e16\u754cHi");

        expect(textsFor(CJK)).toEqual(["\u4e16\u754c"]);
        expect(textsFor(LATIN)).toEqual(["Hi"]);
      });

      it("should create separate segments for each alternating run", async () => {
        // "A世B界" → 4 segments: "A", "世", "B", "界"
        await manager.prepareText("Seg", "A\u4e16B\u754c");

        expect(textsFor(LATIN)).toEqual(["A", "B"]);
        expect(textsFor(CJK)).toEqual(["\u4e16", "\u754c"]);
      });

      it("should group consecutive same-face characters into one segment", async () => {
        // "ABCD世界好人" → "ABCD" latin, "世界好人" cjk
        await manager.prepareText("Seg", "ABCD\u4e16\u754c\u597d\u4eba");

        expect(textsFor(LATIN)).toEqual(["ABCD"]);
        expect(textsFor(CJK)).toEqual(["\u4e16\u754c\u597d\u4eba"]);
      });

      it("should keep space with the current face instead of re-evaluating", async () => {
        // "Hi 世界" → space stays with latin → "Hi " latin, "世界" cjk
        await manager.prepareText("Seg", "Hi \u4e16\u754c");

        expect(textsFor(LATIN)).toEqual(["Hi "]);
        expect(textsFor(CJK)).toEqual(["\u4e16\u754c"]);
      });

      it("should keep space with CJK face between CJK characters", async () => {
        // "世 界" → space stays with cjk face → "世 界" all cjk
        await manager.prepareText("Seg", "\u4e16 \u754c");

        expect(textsFor(CJK)).toEqual(["\u4e16 \u754c"]);
        expect(textsFor(LATIN)).toEqual([]);
      });

      it("should evaluate space normally when it is the first character", async () => {
        // Space (U+0020) at start: no currentUrl yet → evaluated by range
        // U+0020 is in Latin range (0x0000-0x00FF) → latin face
        await manager.prepareText("Seg", " Hello");

        expect(textsFor(LATIN)).toEqual([" Hello"]);
        expect(textsFor(CJK)).toEqual([]);
      });

      it("should evaluate leading space by range even when followed by CJK", async () => {
        // " 世界" → space (U+0020) at start maps to latin by range,
        // then "世界" maps to cjk → two segments
        await manager.prepareText("Seg", " \u4e16\u754c");

        expect(textsFor(LATIN)).toEqual([" "]);
        expect(textsFor(CJK)).toEqual(["\u4e16\u754c"]);
      });

      it("should fall back unmapped codepoints to the first face", async () => {
        // Emoji U+1F600 is not in Latin (0-0xFF) or CJK range → first face (latin)
        await manager.prepareText("Seg", "\u{1F600}");

        expect(textsFor(LATIN)).toEqual(["\u{1F600}"]);
        expect(textsFor(CJK)).toEqual([]);
      });

      it("should group unmapped codepoints with adjacent same-face text", async () => {
        // "A😀B" → A is latin, 😀 fallback to latin, B is latin → single segment
        await manager.prepareText("Seg", "A\u{1F600}B");

        expect(textsFor(LATIN)).toEqual(["A\u{1F600}B"]);
      });

      it("should split when unmapped codepoint sits between different faces", async () => {
        // "世😀B" → "世" cjk, "😀" fallback to latin, "B" latin → two segments
        await manager.prepareText("Seg", "\u4e16\u{1F600}B");

        expect(textsFor(CJK)).toEqual(["\u4e16"]);
        expect(textsFor(LATIN)).toEqual(["\u{1F600}B"]);
      });

      it("should handle a single character", async () => {
        await manager.prepareText("Seg", "A");

        expect(textsFor(LATIN)).toEqual(["A"]);
        expect(batchCalls.length).toBe(1);
      });

      it("should use the single-face fast path (whole text, one segment)", async () => {
        manager.registerFontFamily({
          family: "Single",
          faces: [{ url: LATIN, unicodeRanges: [{ from: 0, to: 0xffff }] }],
        });
        setupTrackingMock(
          { [LATIN]: { fontIndex: 0, unitsPerEm: 1000, xAdvance: 500 } },
          "Single",
        );

        await manager.prepareText("Single", "Hello\u4e16\u{1F600}");

        expect(textsFor(LATIN)).toEqual(["Hello\u4e16\u{1F600}"]);
        expect(batchCalls.length).toBe(1);
      });

      it("should segment across three faces", async () => {
        manager.registerFontFamily({
          family: "Tri",
          faces: [
            { url: LATIN, unicodeRanges: [{ from: 0x0000, to: 0x00ff }] },
            {
              url: ARABIC,
              unicodeRanges: [{ from: 0x0600, to: 0x06ff }],
            },
            { url: CJK, unicodeRanges: [{ from: 0x4e00, to: 0x9fff }] },
          ],
        });
        setupTrackingMock(
          {
            [LATIN]: { fontIndex: 0, unitsPerEm: 1000, xAdvance: 500 },
            [ARABIC]: { fontIndex: 1, unitsPerEm: 1000, xAdvance: 600 },
            [CJK]: { fontIndex: 2, unitsPerEm: 1000, xAdvance: 700 },
          },
          "Tri",
        );

        // "A" latin + "ب" (U+0628) arabic + "世" cjk
        await manager.prepareText("Tri", "A\u0628\u4e16");

        expect(textsFor(LATIN)).toEqual(["A"]);
        expect(textsFor(ARABIC)).toEqual(["\u0628"]);
        expect(textsFor(CJK)).toEqual(["\u4e16"]);
      });

      it("should give priority to the first face when unicode ranges overlap", async () => {
        manager.registerFontFamily({
          family: "Overlap",
          faces: [
            {
              url: LATIN,
              unicodeRanges: [{ from: 0x0000, to: 0xffff }],
            },
            { url: CJK, unicodeRanges: [{ from: 0x4e00, to: 0x9fff }] },
          ],
        });
        setupTrackingMock(
          {
            [LATIN]: { fontIndex: 0, unitsPerEm: 1000, xAdvance: 500 },
            [CJK]: { fontIndex: 1, unitsPerEm: 1000, xAdvance: 700 },
          },
          "Overlap",
        );

        // "世" matches both ranges → first face (latin) wins
        await manager.prepareText("Overlap", "\u4e16");

        expect(textsFor(LATIN)).toEqual(["\u4e16"]);
        expect(textsFor(CJK)).toEqual([]);
      });

      it("should handle multiple spaces between faces without splitting", async () => {
        // "Hi   世" → spaces stay with latin → "Hi   " latin, "世" cjk
        await manager.prepareText("Seg", "Hi   \u4e16");

        expect(textsFor(LATIN)).toEqual(["Hi   "]);
        expect(textsFor(CJK)).toEqual(["\u4e16"]);
      });

      it("should handle face with multiple disjoint unicode ranges", async () => {
        manager.registerFontFamily({
          family: "Multi",
          faces: [
            {
              url: LATIN,
              unicodeRanges: [
                { from: 0x0041, to: 0x005a }, // A-Z
                { from: 0x0061, to: 0x007a }, // a-z
              ],
            },
            { url: CJK, unicodeRanges: [{ from: 0x4e00, to: 0x9fff }] },
          ],
        });
        setupTrackingMock(
          {
            [LATIN]: { fontIndex: 0, unitsPerEm: 1000, xAdvance: 500 },
            [CJK]: { fontIndex: 1, unitsPerEm: 1000, xAdvance: 700 },
          },
          "Multi",
        );

        // "AaBb" → all covered by the two disjoint Latin ranges → single segment
        await manager.prepareText("Multi", "AaBb");

        expect(textsFor(LATIN)).toEqual(["AaBb"]);
      });
    });

    // ----- stitching -----

    describe("stitching", () => {
      it("should produce total glyph count equal to the text length", async () => {
        // "Hi世界" → 2 latin + 2 cjk = 4 glyphs
        await manager.prepareText("Seg", "Hi\u4e16\u754c");
        const result = manager.shapeText("Seg", "Hi\u4e16\u754c")!;

        expect(result.glyphs.length).toBe(4);
      });

      it("should preserve glyph fontIndex in text reading order", async () => {
        // fontIndex=0 for latin, fontIndex=1 for cjk
        // "Hi世" → [0, 0, 1]
        await manager.prepareText("Seg", "Hi\u4e16");
        const result = manager.shapeText("Seg", "Hi\u4e16")!;

        expect(result.glyphs.map((g) => g.fontIndex)).toEqual([0, 0, 1]);
      });

      it("should use the first segment's unitsPerEm as the target", async () => {
        setupTrackingMock(
          {
            [LATIN]: { fontIndex: 0, unitsPerEm: 2048, xAdvance: 1000 },
            [CJK]: { fontIndex: 1, unitsPerEm: 1000, xAdvance: 500 },
          },
          "Seg",
        );

        await manager.prepareText("Seg", "A\u4e16");
        const result = manager.shapeText("Seg", "A\u4e16")!;

        expect(result.unitsPerEm).toBe(2048);
      });

      it("should scale all four positioning fields when unitsPerEm differs", async () => {
        setupTrackingMock(
          {
            [LATIN]: { fontIndex: 0, unitsPerEm: 1000, xAdvance: 500 },
            [CJK]: { fontIndex: 1, unitsPerEm: 2000, xAdvance: 800 },
          },
          "Seg",
        );

        await manager.prepareText("Seg", "A\u4e16");
        const result = manager.shapeText("Seg", "A\u4e16")!;

        // Latin glyph: no scaling (unitsPerEm matches target)
        expect(result.glyphs[0].xAdvance).toBe(500);
        expect(result.glyphs[0].yAdvance).toBe(10);
        expect(result.glyphs[0].xOffset).toBe(20);
        expect(result.glyphs[0].yOffset).toBe(30);

        // CJK glyph: scale = 1000 / 2000 = 0.5
        expect(result.glyphs[1].xAdvance).toBeCloseTo(400); // 800 * 0.5
        expect(result.glyphs[1].yAdvance).toBeCloseTo(5); // 10 * 0.5
        expect(result.glyphs[1].xOffset).toBeCloseTo(10); // 20 * 0.5
        expect(result.glyphs[1].yOffset).toBeCloseTo(15); // 30 * 0.5
      });

      it("should not scale when all segments share the same unitsPerEm", async () => {
        await manager.prepareText("Seg", "A\u4e16");
        const result = manager.shapeText("Seg", "A\u4e16")!;

        expect(result.glyphs[0].xAdvance).toBe(500); // latin, unscaled
        expect(result.glyphs[1].xAdvance).toBe(700); // cjk, unscaled
      });

      it("should include metrics from all font indexes", async () => {
        await manager.prepareText("Seg", "A\u4e16");
        const result = manager.shapeText("Seg", "A\u4e16")!;

        const fontIndexes = new Set(result.metrics.map((m) => m.fontIndex));
        expect(fontIndexes).toEqual(new Set([0, 1]));
      });

      it("should deduplicate metrics by fontIndex:glyphId keeping the first", async () => {
        // Override mock so both faces return the same fontIndex:glyphId
        mocks.mockPrepareTextBatch.mockImplementation(
          async (
            fontUrl: string,
            texts: string[],
          ): Promise<BatchPrepareTextResult> => {
            batchCalls.push({ fontUrl, texts });
            return {
              results: texts.map((text) => ({
                text,
                shapeResult: {
                  glyphs: [
                    {
                      glyphId: 1,
                      fontIndex: 0,
                      xAdvance: 500,
                      yAdvance: 0,
                      xOffset: 0,
                      yOffset: 0,
                    },
                  ],
                  metrics: [
                    {
                      glyphId: 1,
                      fontIndex: 0,
                      atlasX: fontUrl === LATIN ? 0 : 99,
                      atlasY: 0,
                      atlasW: 32,
                      atlasH: 32,
                      bearingX: 5,
                      bearingY: 30,
                    },
                  ],
                  unitsPerEm: 1000,
                },
              })),
              atlas: { data: new Uint8Array([1]), width: 64, height: 64 },
              atlasKey: "Seg",
            };
          },
        );

        await manager.prepareText("Seg", "A\u4e16");
        const result = manager.shapeText("Seg", "A\u4e16")!;

        // fontIndex:0, glyphId:1 appears in both segments → first kept
        expect(result.metrics.length).toBe(1);
        expect(result.metrics[0].atlasX).toBe(0); // from latin (first segment)
      });

      it("should correctly stitch when text returns to the same face", async () => {
        // "A世B" → latin "A", cjk "世", latin "B" — 3 segments
        await manager.prepareText("Seg", "A\u4e16B");
        const result = manager.shapeText("Seg", "A\u4e16B")!;

        expect(result.glyphs.length).toBe(3);
        expect(result.glyphs.map((g) => g.fontIndex)).toEqual([0, 1, 0]);
        expect(result.glyphs.map((g) => g.xAdvance)).toEqual([500, 700, 500]);
      });

      it("should handle many alternating segments", async () => {
        // "A世B界C" → 5 segments
        await manager.prepareText("Seg", "A\u4e16B\u754cC");
        const result = manager.shapeText("Seg", "A\u4e16B\u754cC")!;

        expect(result.glyphs.length).toBe(5);
        expect(result.glyphs.map((g) => g.fontIndex)).toEqual([0, 1, 0, 1, 0]);
      });

      it("should stitch three-face results in order", async () => {
        manager.registerFontFamily({
          family: "Tri",
          faces: [
            { url: LATIN, unicodeRanges: [{ from: 0x0000, to: 0x00ff }] },
            {
              url: ARABIC,
              unicodeRanges: [{ from: 0x0600, to: 0x06ff }],
            },
            { url: CJK, unicodeRanges: [{ from: 0x4e00, to: 0x9fff }] },
          ],
        });
        setupTrackingMock(
          {
            [LATIN]: { fontIndex: 0, unitsPerEm: 1000, xAdvance: 500 },
            [ARABIC]: { fontIndex: 1, unitsPerEm: 1000, xAdvance: 600 },
            [CJK]: { fontIndex: 2, unitsPerEm: 1000, xAdvance: 700 },
          },
          "Tri",
        );

        await manager.prepareText("Tri", "A\u0628\u4e16");
        const result = manager.shapeText("Tri", "A\u0628\u4e16")!;

        expect(result.glyphs.length).toBe(3);
        expect(result.glyphs.map((g) => g.fontIndex)).toEqual([0, 1, 2]);
        expect(result.glyphs.map((g) => g.xAdvance)).toEqual([500, 600, 700]);
      });

      it("should scale only the segments whose unitsPerEm differs from the first", async () => {
        // Latin: 1000, Arabic: 2000 (scale 0.5), CJK: 500 (scale 2.0)
        manager.registerFontFamily({
          family: "Mixed",
          faces: [
            { url: LATIN, unicodeRanges: [{ from: 0x0000, to: 0x00ff }] },
            {
              url: ARABIC,
              unicodeRanges: [{ from: 0x0600, to: 0x06ff }],
            },
            { url: CJK, unicodeRanges: [{ from: 0x4e00, to: 0x9fff }] },
          ],
        });
        setupTrackingMock(
          {
            [LATIN]: { fontIndex: 0, unitsPerEm: 1000, xAdvance: 500 },
            [ARABIC]: { fontIndex: 1, unitsPerEm: 2000, xAdvance: 600 },
            [CJK]: { fontIndex: 2, unitsPerEm: 500, xAdvance: 200 },
          },
          "Mixed",
        );

        await manager.prepareText("Mixed", "A\u0628\u4e16");
        const result = manager.shapeText("Mixed", "A\u0628\u4e16")!;

        expect(result.unitsPerEm).toBe(1000);
        // Latin: no scale
        expect(result.glyphs[0].xAdvance).toBe(500);
        // Arabic: scale = 1000/2000 = 0.5
        expect(result.glyphs[1].xAdvance).toBeCloseTo(300);
        // CJK: scale = 1000/500 = 2.0
        expect(result.glyphs[2].xAdvance).toBeCloseTo(400);
      });

      it("should produce a single-segment stitch with no transformation", async () => {
        // All Latin → one segment, stitch is identity
        await manager.prepareText("Seg", "Hello");
        const result = manager.shapeText("Seg", "Hello")!;

        expect(result.glyphs.length).toBe(5);
        expect(result.unitsPerEm).toBe(1000);
        for (const g of result.glyphs) {
          expect(g.fontIndex).toBe(0);
          expect(g.xAdvance).toBe(500);
        }
      });
    });
  });

  // -----------------------------------------------------------------------
  // isTextPrepared
  // -----------------------------------------------------------------------

  describe("isTextPrepared", () => {
    it("should return false for unprepared text", () => {
      expect(manager.isTextPrepared(FONT_URL, "hello")).toBe(false);
    });

    it("should return false for unknown font identifiers", () => {
      expect(manager.isTextPrepared("unknown", "hello")).toBe(false);
    });

    it("should return true after text is prepared", async () => {
      await manager.loadFont(FONT_URL);
      await manager.prepareText(FONT_URL, "hello");

      expect(manager.isTextPrepared(FONT_URL, "hello")).toBe(true);
    });

    it("should return false for different text with the same font", async () => {
      await manager.loadFont(FONT_URL);
      await manager.prepareText(FONT_URL, "hello");

      expect(manager.isTextPrepared(FONT_URL, "world")).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // shapeText
  // -----------------------------------------------------------------------

  describe("shapeText", () => {
    it("should return undefined for unprepared text", () => {
      expect(manager.shapeText(FONT_URL, "hello")).toBeUndefined();
    });

    it("should return undefined for unknown font identifiers", () => {
      expect(manager.shapeText("unknown", "hello")).toBeUndefined();
    });

    it("should return the shaped result after preparation", async () => {
      await manager.loadFont(FONT_URL);
      await manager.prepareText(FONT_URL, "hello");

      const result = manager.shapeText(FONT_URL, "hello");
      expect(result).toBeDefined();
      expect(result!.glyphs).toBeInstanceOf(Array);
      expect(result!.metrics).toBeInstanceOf(Array);
      expect(result!.unitsPerEm).toBe(1000);
    });

    it("should return the correct number of glyphs for the input text", async () => {
      await manager.loadFont(FONT_URL);
      await manager.prepareText(FONT_URL, "abc");

      const result = manager.shapeText(FONT_URL, "abc");
      expect(result!.glyphs.length).toBe(3);
    });
  });

  // -----------------------------------------------------------------------
  // getAtlas
  // -----------------------------------------------------------------------

  describe("getAtlas", () => {
    it("should return undefined when no atlas exists", () => {
      expect(manager.getAtlas(FONT_URL)).toBeUndefined();
    });

    it("should return atlas data after text preparation", async () => {
      await manager.loadFont(FONT_URL);
      await manager.prepareText(FONT_URL, "hello");

      const atlas = manager.getAtlas(FONT_URL);
      expect(atlas).toBeDefined();
      expect(atlas!.data).toBeInstanceOf(Uint8Array);
      expect(atlas!.width).toBe(256);
      expect(atlas!.height).toBe(256);
    });

    it("should resolve a family name to the shared atlas", async () => {
      manager.registerFontFamily(createTestFamily());
      setupBatchMock("TestFamily");
      await manager.prepareText("TestFamily", "Hello");

      expect(manager.getAtlas("TestFamily")).toBeDefined();
    });

    it("should resolve a font URL to its atlas key", async () => {
      setupBatchMock("shared");
      await manager.loadFont(FONT_URL, "shared");
      await manager.prepareText(FONT_URL, "hello");

      // Accessing via the URL should resolve to the "shared" atlas key
      expect(manager.getAtlas(FONT_URL)).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // getAtlasTexture
  // -----------------------------------------------------------------------

  describe("getAtlasTexture", () => {
    it("should return null when no atlas data exists", () => {
      expect(manager.getAtlasTexture(FONT_URL)).toBeNull();
    });

    it("should create a texture from atlas data", async () => {
      await manager.loadFont(FONT_URL);
      await manager.prepareText(FONT_URL, "hello");

      const tex = manager.getAtlasTexture(FONT_URL);
      expect(tex).not.toBeNull();
      expect(tex!.needsUpdate).toBe(true);
    });

    it("should return the same texture instance on subsequent calls", async () => {
      await manager.loadFont(FONT_URL);
      await manager.prepareText(FONT_URL, "hello");

      const tex1 = manager.getAtlasTexture(FONT_URL);
      const tex2 = manager.getAtlasTexture(FONT_URL);
      expect(tex1).toBe(tex2);
    });

    it("should update texture in-place when atlas is dirty", async () => {
      await manager.loadFont(FONT_URL);
      await manager.prepareText(FONT_URL, "hello");
      const tex1 = manager.getAtlasTexture(FONT_URL);

      // Preparing more text makes the atlas dirty again
      await manager.prepareText(FONT_URL, "world");
      const tex2 = manager.getAtlasTexture(FONT_URL);

      expect(tex2).toBe(tex1); // same instance, updated in place
      expect(tex2!.needsUpdate).toBe(true);
    });

    it("should resolve family names to the shared texture", async () => {
      manager.registerFontFamily(createTestFamily());
      setupBatchMock("TestFamily");
      await manager.prepareText("TestFamily", "Hello");

      const tex = manager.getAtlasTexture("TestFamily");
      expect(tex).not.toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Client initialization
  // -----------------------------------------------------------------------

  describe("client initialization", () => {
    it("should reject when concurrencyManager is not set", async () => {
      const bare = new FontManager(WORKER_URL);

      await expect(bare.loadFont(FONT_URL)).rejects.toThrow(
        "concurrencyManager not set",
      );

      bare.dispose();
    });

    it("should create the FontWorkerClient only once across multiple loads", async () => {
      await manager.loadFont("https://fonts.test/a.ttf");
      await manager.loadFont("https://fonts.test/b.ttf");

      expect(mocks.FontWorkerClient).toHaveBeenCalledTimes(1);
    });

    it("should retry client creation after a failure", async () => {
      mocks.mockReady.mockRejectedValueOnce(new Error("init failed"));

      await expect(manager.loadFont(FONT_URL)).rejects.toThrow();

      // Second attempt should work (mockReady falls back to default resolved)
      mocks.mockReady.mockResolvedValueOnce(undefined);
      await manager.loadFont("https://fonts.test/retry.ttf");

      expect(mocks.FontWorkerClient).toHaveBeenCalledTimes(2);
    });
  });

  // -----------------------------------------------------------------------
  // dispose
  // -----------------------------------------------------------------------

  describe("dispose", () => {
    it("should clear all caches", async () => {
      await manager.loadFont(FONT_URL);
      await manager.prepareText(FONT_URL, "hello");
      manager.registerFontFamily(createTestFamily());

      manager.dispose();

      expect(manager.isTextPrepared(FONT_URL, "hello")).toBe(false);
      expect(manager.getAtlas(FONT_URL)).toBeUndefined();
      expect(manager.getAtlasTexture(FONT_URL)).toBeNull();
      expect(manager.isFamily("TestFamily")).toBe(false);
    });

    it("should dispose all cached textures", async () => {
      await manager.loadFont(FONT_URL);
      await manager.prepareText(FONT_URL, "hello");
      const tex = manager.getAtlasTexture(FONT_URL);

      manager.dispose();

      expect((tex as Record<string, unknown>).disposed).toBe(true);
    });

    it("should dispose the worker client", async () => {
      await manager.loadFont(FONT_URL); // ensures client is created
      manager.dispose();

      expect(mocks.mockClientDispose).toHaveBeenCalled();
    });

    it("should not throw if called before a client was created", () => {
      expect(() => manager.dispose()).not.toThrow();
    });

    it("should be safe to call multiple times", async () => {
      await manager.loadFont(FONT_URL);
      manager.dispose();
      expect(() => manager.dispose()).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe("edge cases", () => {
    it("should reject all queued entries when _ensureClient fails during flush", async () => {
      // Load succeeds initially (client created)
      await manager.loadFont(FONT_URL);

      // Now make prepareTextBatch fail in a way that simulates client issues
      mocks.mockPrepareTextBatch.mockRejectedValueOnce(
        new Error("connection lost"),
      );

      await expect(manager.prepareText(FONT_URL, "oops")).rejects.toThrow(
        "connection lost",
      );
    });

    it("should handle preparing text for multiple fonts simultaneously", async () => {
      const urlA = "https://fonts.test/a.ttf";
      const urlB = "https://fonts.test/b.ttf";
      await manager.loadFont(urlA);
      await manager.loadFont(urlB);

      await Promise.all([
        manager.prepareText(urlA, "alpha"),
        manager.prepareText(urlB, "beta"),
      ]);

      expect(manager.isTextPrepared(urlA, "alpha")).toBe(true);
      expect(manager.isTextPrepared(urlB, "beta")).toBe(true);
    });

    it("should handle batch returning null atlas", async () => {
      mocks.mockPrepareTextBatch.mockResolvedValueOnce({
        results: [{ text: "cached", shapeResult: createShapeResult("cached") }],
        atlas: null,
        atlasKey: FONT_URL,
      } satisfies BatchPrepareTextResult);

      await manager.loadFont(FONT_URL);
      await manager.prepareText(FONT_URL, "cached");

      // No atlas was returned (all glyphs were already in atlas)
      // But shape result should still be cached
      expect(manager.isTextPrepared(FONT_URL, "cached")).toBe(true);
    });

    it("should handle batch returning null shapeResult for a text entry", async () => {
      mocks.mockPrepareTextBatch.mockResolvedValueOnce({
        results: [{ text: "empty", shapeResult: null }],
        atlas: null,
        atlasKey: FONT_URL,
      } satisfies BatchPrepareTextResult);

      await manager.loadFont(FONT_URL);
      await manager.prepareText(FONT_URL, "empty");

      // null shapeResult should not be cached
      expect(manager.isTextPrepared(FONT_URL, "empty")).toBe(false);
    });

    it("should handle font family with empty text segments gracefully", async () => {
      manager.registerFontFamily(createTestFamily());
      setupBatchMock("TestFamily");

      // Empty string returns early
      await manager.prepareText("TestFamily", "");
      expect(mocks.mockPrepareTextBatch).not.toHaveBeenCalled();
    });
  });
});
