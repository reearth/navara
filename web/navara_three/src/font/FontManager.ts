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
};

/** A single shaped glyph with positioning info. */
export type ShapedGlyph = {
  glyphId: number;
  xAdvance: number;
  yAdvance: number;
  xOffset: number;
  yOffset: number;
};

/** Result from shaping text: glyph positions + atlas metrics. */
export type ShapeTextResult = {
  glyphs: ShapedGlyph[];
  metrics: GlyphMetrics[];
  /** Font units per em (needed for converting font-unit to pixel space) */
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
  /** Shared GPU texture per font — all meshes using the same font share one DataTexture. */
  private _textureCache = new Map<string, DataTexture>();
  /** Tracks in-flight prepareText promises to deduplicate. */
  private _preparePending = new Map<string, Promise<void>>();
  /** Microtask batch queue: per-font list of texts awaiting worker dispatch. */
  private _batchQueue = new Map<
    string,
    { text: string; cacheKey: string; resolve: () => void }[]
  >();
  /** Whether a microtask flush is already scheduled. */
  private _batchScheduled = false;

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

    // Queue into microtask batch instead of dispatching immediately.
    // All synchronous prepareText() calls (e.g. from a FeatureEvaluator loop)
    // are coalesced into a single worker message.
    const promise = new Promise<void>((resolve) => {
      let queue = this._batchQueue.get(fontUrl);
      if (!queue) {
        queue = [];
        this._batchQueue.set(fontUrl, queue);
      }
      queue.push({ text, cacheKey, resolve });
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
    for (const tex of this._textureCache.values()) {
      tex.dispose();
    }
    this._textureCache.clear();
    this._client?.dispose();
    this._client = undefined;
  }

  private async _fetchAndLoad(url: string): Promise<void> {
    const client = this._client;
    if (!client) throw new Error("FontManager: worker client not initialized");

    const response = await fetch(url);
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

  private async _flushBatch(): Promise<void> {
    this._batchScheduled = false;
    const client = this._client;
    if (!client) return;

    // Snapshot and clear the queue so new calls during await start a fresh batch
    const queue = this._batchQueue;
    this._batchQueue = new Map();

    for (const [fontUrl, entries] of queue) {
      const texts = entries.map((e) => e.text);

      try {
        const batchResult = await client.prepareTextBatch(fontUrl, texts);

        // Cache each per-text result
        for (const item of batchResult.results) {
          const cacheKey = fontUrl + "\0" + item.text;
          if (item.shapeResult) {
            this._shapeCache.set(cacheKey, item.shapeResult);
          }
        }

        // Update atlas once for the entire batch
        if (batchResult.atlas) {
          this._atlasCache.set(fontUrl, batchResult.atlas);
          this._atlasDirty.add(fontUrl);
        }

        // Resolve all queued promises for this font
        for (const entry of entries) {
          entry.resolve();
        }
      } catch (err) {
        console.error("FontManager: batch prepare failed", err);
        // Resolve anyway to avoid hanging promises
        for (const entry of entries) {
          entry.resolve();
        }
      }
    }
  }
}
