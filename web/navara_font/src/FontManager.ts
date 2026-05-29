import type { ConcurrencyManager } from "@navara/worker";
import {
  DataTexture,
  LinearFilter,
  NoColorSpace,
  RedFormat,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from "three";
import invariant from "tiny-invariant";

import { FontWorkerClient } from "./FontWorkerClient";
import { LRUMap } from "./LRUMap";
import type {
  FontAtlasData,
  FontFace,
  FontFamily,
  GlyphMetrics,
  ShapedGlyph,
  ShapeTextResult,
  TextQuality,
} from "./types";

/** Internal cache key combining an identifier with a quality, so SDF and
 *  MSDF variants of the same font live as separate entries. */
const _q = (identifier: string, quality: TextQuality): string =>
  `${identifier}#q=${quality}`;

/** Create an SDF/MSDF distance-field atlas DataTexture.
 *
 * `channels`: 1 → R8 SDF (sampled as `.r`); 4 → RGBA8 MTSDF (three MSDF
 * channels + true SDF in alpha, sampled as `median(.rgb)`). RGB8 isn't
 * supported because three.js dropped `RGBFormat` in r137. */
export function createSdfAtlasTexture(
  data: Uint8Array,
  width: number,
  height: number,
  channels: number,
): DataTexture {
  const format = channels === 4 ? RGBAFormat : RedFormat;
  // Distance values are linear, not sRGB.
  return createAtlasTexture(data, width, height, format, NoColorSpace);
}

/** Create an RGBA color atlas DataTexture for COLRv1 glyphs.
 *  Pixel data is unpremultiplied sRGB; three.js linearizes on sample. */
export function createColorAtlasTexture(
  data: Uint8Array,
  width: number,
  height: number,
): DataTexture {
  return createAtlasTexture(data, width, height, RGBAFormat, SRGBColorSpace);
}

function createAtlasTexture(
  data: Uint8Array,
  width: number,
  height: number,
  format: typeof RedFormat | typeof RGBAFormat,
  colorSpace: typeof NoColorSpace | typeof SRGBColorSpace,
): DataTexture {
  const tex = new DataTexture(data, width, height, format, UnsignedByteType);
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = colorSpace;
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
  /** Cache color atlas data per font (COLRv1 RGBA). */
  private _colorAtlasCache = new Map<string, FontAtlasData>();
  /** Tracks whether the atlas cache is stale (new glyphs may have been rasterized). */
  private _atlasDirty = new Set<string>();
  /** Tracks whether the color atlas cache is stale. */
  private _colorAtlasDirty = new Set<string>();
  /** Shared GPU texture per font — all meshes using the same font share one DataTexture. */
  private _textureCache = new Map<string, DataTexture>();
  /** Shared color atlas texture per atlas key (RGBA). */
  private _colorTextureCache = new Map<string, DataTexture>();
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
   * Split `text` into runs of consecutive characters that map to the same face.
   * Each character picks the first face whose unicode ranges contain it,
   * falling back to face 0. Spaces stick to the current run to avoid breaking
   * up whitespace.
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
    let currentUrl = "";
    let currentText = "";

    for (const ch of text) {
      const url =
        ch === " " && currentUrl
          ? currentUrl
          : this._findFaceForCodepoint(faces, ch.codePointAt(0) ?? 0);

      if (url === currentUrl) {
        currentText += ch;
      } else {
        if (currentText) segments.push({ url: currentUrl, text: currentText });
        currentUrl = url;
        currentText = ch;
      }
    }
    if (currentText) segments.push({ url: currentUrl, text: currentText });
    return segments;
  }

  /** First face whose unicode ranges contain `codepoint`, or face 0. */
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
   *
   * `atlasKey`: optional shared atlas identifier (e.g. font family name).
   * `quality`: which atlas raster path to use. Two materials referencing the
   * same `url` but different `quality` values produce two independent
   * (font, atlas) entries — both live side-by-side. The browser HTTP cache
   * makes the second fetch effectively free.
   */
  async loadFont(
    url: string,
    quality: TextQuality,
    atlasKey?: string,
  ): Promise<void> {
    const qUrl = _q(url, quality);
    if (this._loaded.has(qUrl)) {
      this._refCount.set(qUrl, (this._refCount.get(qUrl) ?? 0) + 1);
      return;
    }

    if (this._pending.has(qUrl)) {
      this._refCount.set(qUrl, (this._refCount.get(qUrl) ?? 0) + 1);
      return this._pending.get(qUrl);
    }

    // qAtlasKey is `undefined` (worker falls back to the URL, which is itself
    // already qualified) when the caller didn't supply an atlasKey. When they
    // did, we qualify it so families with the same name but different quality
    // get distinct atlases.
    const qAtlasKey = atlasKey ? _q(atlasKey, quality) : undefined;
    const promise = this._fetchAndLoad(url, qUrl, qAtlasKey, quality);
    this._refCount.set(qUrl, 1);
    this._pending.set(qUrl, promise);

    this._shapeCache.set(
      qUrl,
      new LRUMap<string, ShapeTextResult>(SHAPE_CACHE_MAX_SIZE),
    );

    try {
      await promise;
      this._loaded.add(qUrl);
      this._atlasKeys.set(qUrl, qAtlasKey ?? qUrl);
    } catch (err) {
      this._refCount.delete(qUrl);
      this._shapeCache.delete(qUrl);
      throw err;
    } finally {
      this._pending.delete(qUrl);
    }
  }

  async unloadFont(url: string, quality: TextQuality) {
    const qUrl = _q(url, quality);
    const count = this._refCount.get(qUrl);
    if (!count) return;
    if (count > 1) {
      this._refCount.set(qUrl, count - 1);
      return;
    }

    const atlasKey = this._atlasKeys.get(qUrl) ?? qUrl;
    this._loaded.delete(qUrl);
    this._refCount.delete(qUrl);
    this._shapeCache.delete(qUrl);
    this._atlasKeys.delete(qUrl);

    // Drop the atlas only when no other loaded font still references it.
    const stillReferenced = [...this._atlasKeys.values()].includes(atlasKey);
    if (!stillReferenced) {
      this._shapeCache.delete(atlasKey);
      this._atlasCache.delete(atlasKey);
      this._atlasDirty.delete(atlasKey);
      this._colorAtlasCache.delete(atlasKey);
      this._colorAtlasDirty.delete(atlasKey);
      this._textureCache.get(atlasKey)?.dispose();
      this._textureCache.delete(atlasKey);
      this._colorTextureCache.get(atlasKey)?.dispose();
      this._colorTextureCache.delete(atlasKey);
    }

    if (this._client) {
      const result = await this._client.unloadFont(qUrl);
      if (!result.ok) {
        console.warn(`Failed to unload font "${url}" (${quality}) in worker`);
      }
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
    quality: TextQuality,
    loadedFaces?: Set<string>,
  ): Promise<void> {
    if (!text) return;

    const family = this._families.get(fontIdentifier);
    if (family) {
      // Lazy path: load only the face URLs needed for this text that this
      // caller has not loaded yet. `loadedFaces` tracks raw face URLs (no
      // quality suffix), matching the URLs the caller later passes to
      // `unloadFont(url, quality)`. A single set is therefore tied to one
      // quality — callers switching quality should use a fresh set.
      const tracker = loadedFaces ?? new Set<string>();
      const segments = this._segmentTextByFace(family.faces, text);
      const uniqueUrls = [...new Set(segments.map((s) => s.url))];
      await Promise.all(
        uniqueUrls
          .filter((url) => !tracker.has(url))
          .map(async (url) => {
            await this.loadFont(url, quality, fontIdentifier);
            tracker.add(url);
          }),
      );
      return this._prepareFamilyText(fontIdentifier, family, text, quality);
    }

    return this._prepareSingleFontText(fontIdentifier, text, quality);
  }

  /**
   * Check if text has been prepared (sync).
   * Accepts either a font URL or a registered font family name.
   */
  isTextPrepared(
    fontIdentifier: string,
    text: string,
    quality: TextQuality,
  ): boolean {
    return (
      this._shapeCache.get(_q(fontIdentifier, quality))?.has(text) ?? false
    );
  }

  /**
   * Get shaped text from cache. Returns undefined if not yet prepared.
   * Call prepareText() first.
   * Accepts either a font URL or a registered font family name.
   */
  shapeText(
    fontIdentifier: string,
    text: string,
    quality: TextQuality,
  ): ShapeTextResult | undefined {
    return this._shapeCache.get(_q(fontIdentifier, quality))?.get(text);
  }

  /** Prepare text for a single standalone font (non-family path). */
  private async _prepareSingleFontText(
    fontUrl: string,
    text: string,
    quality: TextQuality,
  ): Promise<void> {
    const qUrl = _q(fontUrl, quality);
    const cacheKey = this._cacheKey(qUrl, text);
    if (this._shapeCache.get(qUrl)?.has(text) ?? false) return;
    if (this._preparePending.has(cacheKey))
      return this._preparePending.get(cacheKey);

    const promise = new Promise<void>((resolve, reject) => {
      let queue = this._batchQueue.get(qUrl);
      if (!queue) {
        queue = [];
        this._batchQueue.set(qUrl, queue);
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
    quality: TextQuality,
  ): Promise<void> {
    const qFamily = _q(familyName, quality);
    // Already stitched and cached?
    if (this._shapeCache.get(qFamily)?.has(text)) return;

    const pendingKey = this._cacheKey(qFamily, text);
    if (this._preparePending.has(pendingKey))
      return this._preparePending.get(pendingKey);

    const promise = (async () => {
      const segments = this._segmentTextByFace(family.faces, text);

      // Shape each segment. Face URLs were loaded lazily by prepareText above.
      await Promise.all(
        segments.map((seg) =>
          this._prepareSingleFontText(seg.url, seg.text, quality),
        ),
      );

      // Stitch per-segment results into one combined result
      const stitched = this._stitchSegments(segments, quality);

      let familyShapeCache = this._shapeCache.get(qFamily);
      if (!familyShapeCache) {
        familyShapeCache = new LRUMap<string, ShapeTextResult>(
          SHAPE_CACHE_MAX_SIZE,
        );
        this._shapeCache.set(qFamily, familyShapeCache);
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
    quality: TextQuality,
  ): ShapeTextResult {
    const allGlyphs: ShapedGlyph[] = [];
    const metricsMap = new Map<string, GlyphMetrics>();
    let targetUnitsPerEm = 0;

    for (const seg of segments) {
      const result = this._shapeCache.get(_q(seg.url, quality))?.get(seg.text);
      invariant(
        result,
        `FontManager: missing shape cache for ${seg.url} "${seg.text}" (${quality})`,
      );

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
  getAtlas(
    fontIdentifier: string,
    quality: TextQuality,
  ): FontAtlasData | undefined {
    const key = this._resolveAtlasKey(fontIdentifier, quality);
    return this._atlasCache.get(key);
  }

  /**
   * Shared GPU DataTexture for a font's atlas. Returns the same instance
   * across callers and updates it in-place when the atlas grows. Accepts a
   * font URL or a family name.
   */
  getAtlasTexture(
    fontIdentifier: string,
    quality: TextQuality,
  ): DataTexture | null {
    return this._getOrUpdateTexture(
      this._resolveAtlasKey(fontIdentifier, quality),
      this._atlasCache,
      this._atlasDirty,
      this._textureCache,
      (a) => createSdfAtlasTexture(a.data, a.width, a.height, a.channels),
    );
  }

  /** Color atlas data for a loaded COLRv1 font. `undefined` for monochrome. */
  getColorAtlas(
    fontIdentifier: string,
    quality: TextQuality,
  ): FontAtlasData | undefined {
    const key = this._resolveAtlasKey(fontIdentifier, quality);
    return this._colorAtlasCache.get(key);
  }

  /**
   * Shared GPU DataTexture for a font's COLRv1 color atlas. `null` when no
   * color glyphs have been rasterized under this key.
   */
  getColorAtlasTexture(
    fontIdentifier: string,
    quality: TextQuality,
  ): DataTexture | null {
    return this._getOrUpdateTexture(
      this._resolveAtlasKey(fontIdentifier, quality),
      this._colorAtlasCache,
      this._colorAtlasDirty,
      this._colorTextureCache,
      (a) => createColorAtlasTexture(a.data, a.width, a.height),
    );
  }

  /** Shared "get cached texture, create or refresh from atlas data" path.
   *  When the atlas grew, dispose() releases the GL handle so three.js
   *  reallocates at the new size on the next render instead of overflowing
   *  texSubImage2D. The DataTexture instance is preserved so existing meshes
   *  keep their refs. */
  private _getOrUpdateTexture(
    key: string,
    atlasCache: Map<string, FontAtlasData>,
    dirtySet: Set<string>,
    textureCache: Map<string, DataTexture>,
    create: (atlas: FontAtlasData) => DataTexture,
  ): DataTexture | null {
    if (!dirtySet.has(key)) {
      const cached = textureCache.get(key);
      if (cached) return cached;
    }

    const atlasData = atlasCache.get(key);
    if (!atlasData) return null;

    dirtySet.delete(key);

    const existing = textureCache.get(key);
    if (existing) {
      const dimsChanged =
        existing.image?.width !== atlasData.width ||
        existing.image?.height !== atlasData.height;
      if (dimsChanged) existing.dispose();
      existing.image = {
        data: atlasData.data,
        width: atlasData.width,
        height: atlasData.height,
      };
      existing.needsUpdate = true;
      return existing;
    }

    const tex = create(atlasData);
    textureCache.set(key, tex);
    return tex;
  }

  dispose() {
    for (const tex of this._textureCache.values()) tex.dispose();
    for (const tex of this._colorTextureCache.values()) tex.dispose();
    this._pending.clear();
    this._preparePending.clear();
    this._loaded.clear();
    this._refCount.clear();
    this._shapeCache.clear();
    this._atlasCache.clear();
    this._atlasDirty.clear();
    this._colorAtlasCache.clear();
    this._colorAtlasDirty.clear();
    this._textureCache.clear();
    this._colorTextureCache.clear();
    this._families.clear();
    this._atlasKeys.clear();
    this._client?.dispose();
    this._client = undefined;
  }

  private _cacheKey(fontUrl: string, text: string): string {
    return fontUrl + "\0" + text;
  }

  /** Resolve a (font identifier, quality) pair to its qualified atlas key.
   *  Family names get a quality suffix and become their own atlas key; font
   *  URLs are looked up via `_atlasKeys` (already-qualified keys). */
  private _resolveAtlasKey(
    fontIdentifier: string,
    quality: TextQuality,
  ): string {
    if (this._families.has(fontIdentifier)) return _q(fontIdentifier, quality);
    return (
      this._atlasKeys.get(_q(fontIdentifier, quality)) ??
      _q(fontIdentifier, quality)
    );
  }

  /** Fetch + worker-load a font for a single (url, quality) combination.
   *
   *  `rawUrl` is the network URL (no `#q=...` fragment). `qUrl` and
   *  `qAtlasKey` are the qualified identifiers the worker will use as
   *  FontEntry / atlas keys. The worker side treats `qUrl` as opaque, so the
   *  same `rawUrl` can be loaded twice (once per quality) without collision.
   */
  private async _fetchAndLoad(
    rawUrl: string,
    qUrl: string,
    qAtlasKey: string | undefined,
    quality: TextQuality,
  ): Promise<void> {
    const client = await this._ensureClient();

    const response = await fetch(rawUrl);
    if (!response.ok) {
      throw new Error(
        `FontManager: failed to fetch font from ${rawUrl}: ${response.status}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const result = await client.loadFont(qUrl, arrayBuffer, qAtlasKey, quality);

    if (!result.ok) {
      throw new Error(`FontManager: WASM failed to load font from ${rawUrl}`);
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

        // Update atlases once for the entire batch, keyed by atlas key
        // (family name for font-family faces, or font URL for standalone fonts)
        const atlasKey = batchResult.atlasKey;
        if (batchResult.atlas) {
          this._atlasCache.set(atlasKey, batchResult.atlas);
          this._atlasDirty.add(atlasKey);
        }
        if (batchResult.colorAtlas) {
          this._colorAtlasCache.set(atlasKey, batchResult.colorAtlas);
          this._colorAtlasDirty.add(atlasKey);
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
