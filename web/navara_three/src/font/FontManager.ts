import { DataTexture, LinearFilter, RedFormat, UnsignedByteType } from "three";

import type { FontWorkerClient } from "./FontWorkerClient";

/** Glyph metrics from the SDF atlas. */
export type GlyphMetrics = {
  glyphId: number;
  atlasX: number;
  atlasY: number;
  atlasW: number;
  atlasH: number;
  bearingX: number;
  bearingY: number;
  advance: number;
};

/** A single shaped glyph with positioning info. */
export type ShapedGlyph = {
  glyphId: number;
  xAdvance: number;
  yAdvance: number;
  xOffset: number;
  yOffset: number;
  cluster: number;
};

/** Result from shaping text: glyph positions + atlas metrics. */
export type ShapeTextResult = {
  glyphs: ShapedGlyph[];
  metrics: GlyphMetrics[];
  /** Font units per em (needed for converting font-unit advances to SDF pixel space) */
  unitsPerEm: number;
};

/** SDF atlas texture data. */
export type FontAtlasData = {
  data: Uint8Array;
  width: number;
  height: number;
};

/**
 * Manages font loading, text shaping, and SDF atlas access.
 *
 * Delegates heavy computation (shaping, SDF rasterization, atlas packing)
 * to a dedicated Web Worker via FontWorkerClient. GPU texture management
 * (DataTexture creation/update) stays on the main thread.
 */
export class FontManager {
  private _client: FontWorkerClient | undefined;
  /** Tracks in-flight fetch promises to avoid duplicate requests. */
  private _pending = new Map<string, Promise<void>>();
  /** Tracks fonts that have been successfully loaded. */
  private _loaded = new Set<string>();
  /** Cache shaped text results to avoid redundant worker calls. Key: "fontUrl\0text" */
  private _shapeCache = new Map<string, ShapeTextResult>();
  /** Cache atlas data per font to avoid redundant copies. */
  private _atlasCache = new Map<string, FontAtlasData>();
  /** Tracks whether the atlas cache is stale (new glyphs may have been rasterized). */
  private _atlasDirty = new Set<string>();
  /** Tracks known rasterized glyph IDs per font to detect atlas mutations. */
  private _knownGlyphs = new Map<string, Set<number>>();
  /** Shared GPU texture per font — all meshes using the same font share one DataTexture. */
  private _textureCache = new Map<string, DataTexture>();
  /** Tracks in-flight prepareText promises to deduplicate. */
  private _preparePending = new Map<string, Promise<void>>();

  setClient(client: FontWorkerClient) {
    this._client = client;
  }

  /**
   * Load a font from a URL. Fetches the font file and sends it to the worker.
   * Returns immediately if the font is already loaded. Deduplicates concurrent requests.
   */
  async loadFont(url: string): Promise<void> {
    if (this._loaded.has(url)) return;
    if (this._pending.has(url)) return this._pending.get(url);

    const promise = this._fetchAndLoad(url);
    this._pending.set(url, promise);

    try {
      await promise;
      this._loaded.add(url);
    } finally {
      this._pending.delete(url);
    }
  }

  /** Check if a font has been loaded and is ready for use. */
  isFontLoaded(url: string): boolean {
    return this._loaded.has(url);
  }

  /**
   * Prepare text for rendering: shapes text and updates atlas in the worker.
   * Must be called (and awaited) before shapeText() will return data for this text.
   */
  async prepareText(fontUrl: string, text: string): Promise<void> {
    if (!this._client) return;
    if (!text) return;

    const cacheKey = fontUrl + "\0" + text;
    if (this._shapeCache.has(cacheKey)) return;
    if (this._preparePending.has(cacheKey))
      return this._preparePending.get(cacheKey);

    const promise = this._doPrepareText(fontUrl, text, cacheKey);
    this._preparePending.set(cacheKey, promise);
    try {
      await promise;
    } finally {
      this._preparePending.delete(cacheKey);
    }
  }

  /** Check if text has been prepared (sync). */
  isTextPrepared(fontUrl: string, text: string): boolean {
    const cacheKey = fontUrl + "\0" + text;
    return this._shapeCache.has(cacheKey);
  }

  /**
   * Get shaped text from cache. Returns undefined if not yet prepared.
   * Call prepareText() first.
   */
  shapeText(fontUrl: string, text: string): ShapeTextResult | undefined {
    const cacheKey = fontUrl + "\0" + text;
    return this._shapeCache.get(cacheKey);
  }

  /** Get the SDF atlas data for a loaded font from cache. */
  getAtlas(fontUrl: string): FontAtlasData | undefined {
    return this._atlasCache.get(fontUrl);
  }

  /**
   * Get a shared GPU DataTexture for a font's atlas.
   * Returns the same texture instance for all callers using the same font.
   * Creates the texture on first call; updates it in-place when the atlas grows.
   */
  getAtlasTexture(fontUrl: string): DataTexture | null {
    if (!this._atlasDirty.has(fontUrl)) {
      const cached = this._textureCache.get(fontUrl);
      if (cached) return cached;
    }

    const atlasData = this.getAtlas(fontUrl);
    if (!atlasData) return null;

    const existing = this._textureCache.get(fontUrl);
    if (existing) {
      // Update in-place if atlas data changed
      existing.image = {
        data: atlasData.data,
        width: atlasData.width,
        height: atlasData.height,
      };
      existing.needsUpdate = true;
      this._atlasDirty.delete(fontUrl);
      return existing;
    }

    const tex = new DataTexture(
      atlasData.data,
      atlasData.width,
      atlasData.height,
      RedFormat,
      UnsignedByteType,
    );
    tex.minFilter = LinearFilter;
    tex.magFilter = LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    this._textureCache.set(fontUrl, tex);
    this._atlasDirty.delete(fontUrl);
    return tex;
  }

  dispose() {
    this._pending.clear();
    this._preparePending.clear();
    this._loaded.clear();
    this._shapeCache.clear();
    this._atlasCache.clear();
    this._atlasDirty.clear();
    this._knownGlyphs.clear();
    for (const tex of this._textureCache.values()) {
      tex.dispose();
    }
    this._textureCache.clear();
    this._client?.dispose();
    this._client = undefined;
  }

  private async _fetchAndLoad(url: string): Promise<void> {
    console.log(`FontManager: fetching font from ${url}`);
    const client = this._client;
    if (!client) throw new Error("FontManager: worker client not initialized");

    const response = await fetch(url, { priority: "low" });
    if (!response.ok) {
      throw new Error(
        `FontManager: failed to fetch font from ${url}: ${response.status}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const result = await client.loadFont(url, arrayBuffer);

    if (!result.ok) {
      throw new Error(`FontManager: WASM failed to load font from ${url}`);
    }
  }

  private async _doPrepareText(
    fontUrl: string,
    text: string,
    cacheKey: string,
  ): Promise<void> {
    const client = this._client;
    if (!client) return;

    const result = await client.prepareText(fontUrl, text);

    if (result.shapeResult) {
      this._shapeCache.set(cacheKey, result.shapeResult);
    }

    if (result.atlas) {
      this._atlasCache.set(fontUrl, result.atlas);

      // Track new glyph IDs for dirty detection
      let knownSet = this._knownGlyphs.get(fontUrl);
      if (!knownSet) {
        knownSet = new Set();
        this._knownGlyphs.set(fontUrl, knownSet);
      }
      let hasNewGlyphs = false;
      if (result.shapeResult) {
        for (const m of result.shapeResult.metrics) {
          if (!knownSet.has(m.glyphId)) {
            knownSet.add(m.glyphId);
            hasNewGlyphs = true;
          }
        }
      }
      if (hasNewGlyphs) {
        this._atlasDirty.add(fontUrl);
      }
    }
  }
}
