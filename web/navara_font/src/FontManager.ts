import type { ConcurrencyManager } from "@navara/worker";
import { DataTexture, LinearFilter, RedFormat, UnsignedByteType } from "three";

import { FontWorkerClient } from "./FontWorkerClient";
import { LRUMap } from "./LRUMap";
import type {
  FontAtlasData,
  FontFace,
  FontFamily,
  GlyphMetrics,
  ShapedGlyph,
  ShapeTextResult,
} from "./types";

/** Create a single-channel SDF atlas DataTexture with standard filtering. */
export function createSdfAtlasTexture(
  data: Uint8Array,
  width: number,
  height: number,
): DataTexture {
  const tex = new DataTexture(data, width, height, RedFormat, UnsignedByteType);
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/** Maximum number of shaped text results to cache before LRU eviction. */
const SHAPE_CACHE_MAX_SIZE = 10_000;

/**
 * Manages font loading, text shaping, and SDF atlas access.
 *
 * Delegates heavy computation (shaping, SDF rasterization, atlas packing)
 * to a dedicated Web Worker via FontWorkerClient. GPU texture management
 * (DataTexture creation/update) stays on the main thread.
 */
export class FontManager {
  private _workerUrl: string | URL;
  private _client: FontWorkerClient | undefined;
  private _clientPromise: Promise<FontWorkerClient> | undefined;
  private _concurrencyManager: ConcurrencyManager | undefined;
  /** Tracks in-flight fetch promises to avoid duplicate requests. */
  private _pending = new Map<string, Promise<void>>();
  /** Tracks fonts that have been successfully loaded. */
  private _loaded = new Set<string>();
  /** Cache shaped text results to avoid redundant worker calls (LRU-evicted). */
  private _shapeCache = new Map<string, LRUMap<string, ShapeTextResult>>();
  /** Cache atlas data per font to avoid redundant copies. */
  private _atlasCache = new Map<string, FontAtlasData>();
  /** Tracks whether the atlas cache is stale (new glyphs may have been rasterized). */
  private _atlasDirty = new Set<string>();
  /** Shared GPU texture per font — all meshes using the same font share one DataTexture. */
  private _textureCache = new Map<string, DataTexture>();
  /** Tracks in-flight prepareText promises to deduplicate. */
  private _preparePending = new Map<string, Promise<void>>();
  /** Microtask batch queue: per-font list of texts awaiting worker dispatch. */
  private _batchQueue = new Map<
    string,
    {
      text: string;
      cacheKey: string;
      resolve: () => void;
      reject: (reason: unknown) => void;
    }[]
  >();
  /** Whether a microtask flush is already scheduled. */
  private _batchScheduled = false;

  private _refCount = new Map<string, number>();
  /** Registered font families, keyed by family name. */
  private _families = new Map<string, FontFamily>();
  /** Maps font URL → atlas key (family name or URL for standalone fonts). */
  private _atlasKeys = new Map<string, string>();

  constructor(workerUrl: string | URL) {
    this._workerUrl = workerUrl;
  }

  setConcurrencyManager(concurrencyManager: ConcurrencyManager) {
    this._concurrencyManager = concurrencyManager;
  }

  /**
   * Register a font family with multiple faces.
   * No font files are loaded until text is prepared.
   */
  registerFontFamily(family: FontFamily): void {
    this._families.set(family.family, family);
  }

  /**
   * Remove a registered font family. No font resources are unloaded here —
   * each mesh that used this family tracks its loaded face URLs and unloads
   * them individually on dispose.
   */
  unregisterFontFamily(familyName: string): void {
    this._families.delete(familyName);
  }

  /** Check whether a font identifier is a registered family name. */
  isFamily(fontIdentifier: string): boolean {
    return this._families.has(fontIdentifier);
  }

  /**
   * Segment text into runs where each run maps to a specific font face.
   * For each character, the first face whose unicodeRanges contain the
   * codepoint wins. Consecutive characters mapping to the same face are
   * grouped into a single segment. Falls back to the first face for
   * codepoints not covered by any face.
   */
  private _segmentTextByFace(
    faces: FontFace[],
    text: string,
  ): { url: string; text: string }[] {
    if (faces.length === 0) {
      throw new Error("FontManager: font family has no faces");
    }
    if (faces.length === 1) return [{ url: faces[0].url, text }];

    const segments: { url: string; text: string }[] = [];
    let currentUrl: string | null = null;
    let currentChars: string[] = [];

    for (const ch of text) {
      const cp = ch.codePointAt(0) ?? 0;
      // make space character use current face to avoid unnecessary segmentation of whitespace
      const url: string =
        ch === " " && currentUrl
          ? currentUrl
          : this._findFaceForCodepoint(faces, cp);

      if (url !== currentUrl) {
        if (currentUrl !== null && currentChars.length > 0) {
          segments.push({ url: currentUrl, text: currentChars.join("") });
        }
        currentUrl = url;
        currentChars = [ch];
      } else {
        currentChars.push(ch);
      }
    }

    if (currentUrl !== null && currentChars.length > 0) {
      segments.push({ url: currentUrl, text: currentChars.join("") });
    }

    return segments;
  }

  /** Find the first face whose unicode ranges contain the given codepoint. */
  private _findFaceForCodepoint(faces: FontFace[], codepoint: number): string {
    for (const face of faces) {
      for (const range of face.unicodeRanges) {
        if (codepoint >= range.from && codepoint <= range.to) {
          return face.url;
        }
      }
    }
    return faces[0].url;
  }

  private _ensureClient(): Promise<FontWorkerClient> {
    if (this._client) return Promise.resolve(this._client);
    if (this._clientPromise) return this._clientPromise;
    if (!this._concurrencyManager) {
      return Promise.reject(
        new Error("FontManager: concurrencyManager not set"),
      );
    }
    const cm = this._concurrencyManager;
    this._clientPromise = (async () => {
      const client = new FontWorkerClient(this._workerUrl, cm);
      await client.ready();
      this._client = client;
      return client;
    })();
    this._clientPromise.catch(() => {
      this._clientPromise = undefined;
    });
    return this._clientPromise;
  }

  /**
   * Load a font from a URL. Fetches the font file and sends it to the worker.
   * Returns immediately if the font is already loaded. Deduplicates concurrent requests.
   * `atlasKey`: optional shared atlas identifier (e.g. font family name).
   */
  async loadFont(url: string, atlasKey?: string): Promise<void> {
    if (this._loaded.has(url)) {
      this._refCount.set(url, (this._refCount.get(url) ?? 0) + 1);
      return;
    }

    if (this._pending.has(url)) {
      this._refCount.set(url, (this._refCount.get(url) ?? 0) + 1);
      return this._pending.get(url);
    }

    const promise = this._fetchAndLoad(url, atlasKey);
    this._refCount.set(url, 1);
    this._pending.set(url, promise);

    this._shapeCache.set(
      url,
      new LRUMap<string, ShapeTextResult>(SHAPE_CACHE_MAX_SIZE),
    );

    try {
      await promise;
      this._loaded.add(url);
      this._atlasKeys.set(url, atlasKey ?? url);
    } catch (err) {
      this._refCount.delete(url);
      this._shapeCache.delete(url);
      throw err;
    } finally {
      this._pending.delete(url);
    }
  }

  async unloadFont(url: string) {
    const count = this._refCount.get(url);
    if (!count) return; // Not loaded or already fully unloaded
    if (count === 1) {
      const atlasKey = this._atlasKeys.get(url) ?? url;

      this._loaded.delete(url);
      this._refCount.delete(url);
      this._shapeCache.delete(url);
      this._atlasKeys.delete(url);

      // Only clean up atlas/texture when no other loaded font shares the same atlas key
      const stillReferenced = [...this._atlasKeys.values()].some(
        (k) => k === atlasKey,
      );
      if (!stillReferenced) {
        this._shapeCache.delete(atlasKey);
        this._atlasCache.delete(atlasKey);
        this._atlasDirty.delete(atlasKey);
        const tex = this._textureCache.get(atlasKey);
        if (tex) {
          tex.dispose();
          this._textureCache.delete(atlasKey);
        }
      }

      if (this._client) {
        const result = await this._client.unloadFont(url);
        if (!result.ok) {
          console.warn(`Failed to unload font "${url}" in worker`);
        }
      }
    } else {
      this._refCount.set(url, count - 1);
    }
  }

  /**
   * Prepare text for rendering: shapes text and updates atlas in the worker.
   * Must be called (and awaited) before shapeText() will return data for this text.
   * Accepts either a font URL or a registered font family name.
   *
   * For font families, face URLs are loaded lazily — only the faces whose
   * unicode ranges cover `text` are fetched. Pass a caller-owned `loadedFaces`
   * Set to track which URLs were loaded; the caller must call unloadFont() for
   * each URL in the set on dispose. Passing the same set across multiple calls
   * ensures each face URL is loaded exactly once per caller.
   *
   * For standalone font URLs the font must already be loaded via loadFont().
   */
  async prepareText(
    fontIdentifier: string,
    text: string,
    loadedFaces?: Set<string>,
  ): Promise<void> {
    if (!text) return;

    const family = this._families.get(fontIdentifier);
    if (family) {
      // Lazy path: load only the face URLs needed for this text that this
      // caller has not loaded yet.
      const tracker = loadedFaces ?? new Set<string>();
      const segments = this._segmentTextByFace(family.faces, text);
      const uniqueUrls = [...new Set(segments.map((s) => s.url))];
      await Promise.all(
        uniqueUrls
          .filter((url) => !tracker.has(url))
          .map(async (url) => {
            await this.loadFont(url, fontIdentifier);
            tracker.add(url);
          }),
      );
      return this._prepareFamilyText(fontIdentifier, family, text);
    }

    return this._prepareSingleFontText(fontIdentifier, text);
  }

  /**
   * Check if text has been prepared (sync).
   * Accepts either a font URL or a registered font family name.
   */
  isTextPrepared(fontIdentifier: string, text: string): boolean {
    return this._shapeCache.get(fontIdentifier)?.has(text) ?? false;
  }

  /**
   * Get shaped text from cache. Returns undefined if not yet prepared.
   * Call prepareText() first.
   * Accepts either a font URL or a registered font family name.
   */
  shapeText(fontIdentifier: string, text: string): ShapeTextResult | undefined {
    return this._shapeCache.get(fontIdentifier)?.get(text);
  }

  /** Prepare text for a single standalone font (non-family path). */
  private async _prepareSingleFontText(
    fontUrl: string,
    text: string,
  ): Promise<void> {
    const cacheKey = this._cacheKey(fontUrl, text);
    if (this._shapeCache.get(fontUrl)?.has(text) ?? false) return;
    if (this._preparePending.has(cacheKey))
      return this._preparePending.get(cacheKey);

    const promise = new Promise<void>((resolve, reject) => {
      let queue = this._batchQueue.get(fontUrl);
      if (!queue) {
        queue = [];
        this._batchQueue.set(fontUrl, queue);
      }
      queue.push({ text, cacheKey, resolve, reject });
    });

    this._preparePending.set(cacheKey, promise);

    if (!this._batchScheduled) {
      this._batchScheduled = true;
      queueMicrotask(() => this._flushBatch());
    }

    try {
      await promise;
    } finally {
      this._preparePending.delete(cacheKey);
    }
  }

  /** Prepare text for a font family: segment, shape per-face, stitch. */
  private async _prepareFamilyText(
    familyName: string,
    family: FontFamily,
    text: string,
  ): Promise<void> {
    // Already stitched and cached?
    if (this._shapeCache.get(familyName)?.has(text)) return;

    const pendingKey = this._cacheKey(familyName, text);
    if (this._preparePending.has(pendingKey))
      return this._preparePending.get(pendingKey);

    const promise = (async () => {
      const segments = this._segmentTextByFace(family.faces, text);

      // Shape each segment. Face URLs were loaded lazily by prepareText above.
      await Promise.all(
        segments.map((seg) => this._prepareSingleFontText(seg.url, seg.text)),
      );

      // Stitch per-segment results into one combined result
      const stitched = this._stitchSegments(segments);

      let familyShapeCache = this._shapeCache.get(familyName);
      if (!familyShapeCache) {
        familyShapeCache = new LRUMap<string, ShapeTextResult>(
          SHAPE_CACHE_MAX_SIZE,
        );
        this._shapeCache.set(familyName, familyShapeCache);
      }
      familyShapeCache.set(text, stitched);
    })();

    this._preparePending.set(pendingKey, promise);
    try {
      await promise;
    } finally {
      this._preparePending.delete(pendingKey);
    }
  }

  /** Combine shaped results from multiple face segments into one result.
   *
   * All glyph advances/offsets and bearing values are normalized to the first
   * segment's unitsPerEm so the consumer can apply a single scale factor.
   */
  private _stitchSegments(
    segments: { url: string; text: string }[],
  ): ShapeTextResult {
    const allGlyphs: ShapedGlyph[] = [];
    const metricsMap = new Map<string, GlyphMetrics>();
    let targetUnitsPerEm = 0;

    for (const seg of segments) {
      const result = this._shapeCache.get(seg.url)?.get(seg.text);
      if (!result) {
        throw new Error(
          `FontManager: missing shape result for face "${seg.url}" text "${seg.text}"`,
        );
      }

      if (targetUnitsPerEm === 0) targetUnitsPerEm = result.unitsPerEm;
      const scale = targetUnitsPerEm / result.unitsPerEm;

      for (const g of result.glyphs) {
        allGlyphs.push(
          scale === 1
            ? g
            : {
                ...g,
                xAdvance: g.xAdvance * scale,
                yAdvance: g.yAdvance * scale,
                xOffset: g.xOffset * scale,
                yOffset: g.yOffset * scale,
              },
        );
      }

      for (const m of result.metrics) {
        const key = `${m.fontIndex}:${m.glyphId}`;
        if (!metricsMap.has(key)) {
          metricsMap.set(key, m);
        }
      }
    }

    if (targetUnitsPerEm === 0) {
      throw new Error("FontManager: _stitchSegments produced unitsPerEm of 0");
    }

    return {
      glyphs: allGlyphs,
      metrics: [...metricsMap.values()],
      unitsPerEm: targetUnitsPerEm,
    };
  }

  /**
   * Get the SDF atlas data for a loaded font from cache.
   * Accepts either a font URL or a registered font family name.
   * For families, the atlas is shared across all faces.
   */
  getAtlas(fontIdentifier: string): FontAtlasData | undefined {
    const key = this._resolveAtlasKey(fontIdentifier);
    return this._atlasCache.get(key);
  }

  /**
   * Get a shared GPU DataTexture for a font's atlas.
   * Returns the same texture instance for all callers using the same font.
   * Creates the texture on first call; updates it in-place when the atlas grows.
   * Accepts either a font URL or a registered font family name.
   * For families, all faces share the same texture.
   */
  getAtlasTexture(fontIdentifier: string): DataTexture | null {
    const key = this._resolveAtlasKey(fontIdentifier);

    if (!this._atlasDirty.has(key)) {
      const cached = this._textureCache.get(key);
      if (cached) return cached;
    }

    const atlasData = this._atlasCache.get(key);
    if (!atlasData) return null;

    const existing = this._textureCache.get(key);
    if (existing) {
      // Update in-place if atlas data changed
      existing.image = {
        data: atlasData.data,
        width: atlasData.width,
        height: atlasData.height,
      };
      existing.needsUpdate = true;
      this._atlasDirty.delete(key);
      return existing;
    }

    const tex = createSdfAtlasTexture(
      atlasData.data,
      atlasData.width,
      atlasData.height,
    );
    this._textureCache.set(key, tex);
    this._atlasDirty.delete(key);
    return tex;
  }

  dispose() {
    this._pending.clear();
    this._preparePending.clear();
    this._loaded.clear();
    this._refCount.clear();
    this._shapeCache.clear();
    this._atlasCache.clear();
    this._atlasDirty.clear();
    for (const tex of this._textureCache.values()) {
      tex.dispose();
    }
    this._textureCache.clear();
    this._families.clear();
    this._atlasKeys.clear();
    this._client?.dispose();
    this._client = undefined;
  }

  private _cacheKey(fontUrl: string, text: string): string {
    return fontUrl + "\0" + text;
  }

  /** Resolve a font identifier to its atlas key.
   *  Family names are their own atlas key; font URLs are looked up via _atlasKeys. */
  private _resolveAtlasKey(fontIdentifier: string): string {
    // If it's a registered family name, that IS the atlas key
    if (this._families.has(fontIdentifier)) return fontIdentifier;
    // For font URLs, resolve via the atlas key map (falls back to URL itself)
    return this._atlasKeys.get(fontIdentifier) ?? fontIdentifier;
  }

  private async _fetchAndLoad(url: string, atlasKey?: string): Promise<void> {
    const client = await this._ensureClient();

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `FontManager: failed to fetch font from ${url}: ${response.status}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const result = await client.loadFont(url, arrayBuffer, atlasKey);

    if (!result.ok) {
      throw new Error(`FontManager: WASM failed to load font from ${url}`);
    }
  }

  private async _flushBatch(): Promise<void> {
    this._batchScheduled = false;

    // Snapshot and clear the queue so new calls during await start a fresh batch
    const queue = this._batchQueue;
    this._batchQueue = new Map();

    let client: FontWorkerClient;
    try {
      client = await this._ensureClient();
    } catch (err) {
      // If we fail to obtain a client, reject all queued entries so their
      // corresponding promises do not remain pending indefinitely.
      for (const [, entries] of queue) {
        for (const entry of entries) {
          entry.reject(err);
        }
      }
      return;
    }

    const processFontBatch = async (
      fontUrl: string,
      entries: {
        text: string;
        cacheKey: string;
        resolve: () => void;
        reject: (reason: unknown) => void;
      }[],
    ) => {
      const texts = entries.map((e) => e.text);

      try {
        const batchResult = await client.prepareTextBatch(fontUrl, texts);

        // Cache each per-text result
        for (const item of batchResult.results) {
          if (item.shapeResult) {
            this._shapeCache.get(fontUrl)?.set(item.text, item.shapeResult);
          }
        }

        // Update atlas once for the entire batch, keyed by atlas key
        // (family name for font-family faces, or font URL for standalone fonts)
        if (batchResult.atlas) {
          const atlasKey = batchResult.atlasKey;
          this._atlasCache.set(atlasKey, batchResult.atlas);
          this._atlasDirty.add(atlasKey);
        }

        for (const entry of entries) {
          entry.resolve();
        }
      } catch (err) {
        for (const entry of entries) {
          entry.reject(err);
        }
      }
    };

    await Promise.all(
      [...queue].map(([fontUrl, entries]) =>
        processFontBatch(fontUrl, entries),
      ),
    );
  }
}
