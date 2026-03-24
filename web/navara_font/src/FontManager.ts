import FontWorkerURL from "@navara/font/fontWorker?worker&url";
import type { ConcurrencyManager } from "@navara/worker";
import { DataTexture, LinearFilter, RedFormat, UnsignedByteType } from "three";

import { FontWorkerClient } from "./FontWorkerClient";
import { LRUMap } from "./LRUMap";

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

  setConcurrencyManager(concurrencyManager: ConcurrencyManager) {
    this._concurrencyManager = concurrencyManager;
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
      const client = new FontWorkerClient(FontWorkerURL, cm);
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
   */
  async loadFont(url: string): Promise<void> {
    if (this._loaded.has(url)) {
      this._refCount.set(url, (this._refCount.get(url) ?? 0) + 1);
      return;
    }

    if (this._pending.has(url)) {
      this._refCount.set(url, (this._refCount.get(url) ?? 0) + 1);
      return this._pending.get(url);
    }

    const promise = this._fetchAndLoad(url);
    this._refCount.set(url, 1);
    this._pending.set(url, promise);

    this._shapeCache.set(
      url,
      new LRUMap<string, ShapeTextResult>(SHAPE_CACHE_MAX_SIZE),
    );

    try {
      await promise;
      this._loaded.add(url);
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
      this._loaded.delete(url);
      this._refCount.delete(url);
      this._shapeCache.delete(url);
      this._atlasCache.delete(url);
      this._atlasDirty.delete(url);
      const tex = this._textureCache.get(url);
      if (tex) {
        tex.dispose();
        this._textureCache.delete(url);
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
   */
  async prepareText(fontUrl: string, text: string): Promise<void> {
    if (!text) return;

    const cacheKey = this._cacheKey(fontUrl, text);
    if (this._shapeCache.get(fontUrl)?.has(text) ?? false) return;
    if (this._preparePending.has(cacheKey))
      return this._preparePending.get(cacheKey);

    // Queue into microtask batch instead of dispatching immediately.
    // All synchronous prepareText() calls (e.g. from a FeatureEvaluator loop)
    // are coalesced into a single worker message.
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

  /** Check if text has been prepared (sync). */
  isTextPrepared(fontUrl: string, text: string): boolean {
    return this._shapeCache.get(fontUrl)?.has(text) ?? false;
  }

  /**
   * Get shaped text from cache. Returns undefined if not yet prepared.
   * Call prepareText() first.
   */
  shapeText(fontUrl: string, text: string): ShapeTextResult | undefined {
    return this._shapeCache.get(fontUrl)?.get(text);
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

    const tex = createSdfAtlasTexture(
      atlasData.data,
      atlasData.width,
      atlasData.height,
    );
    this._textureCache.set(fontUrl, tex);
    this._atlasDirty.delete(fontUrl);
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
    this._client?.dispose();
    this._client = undefined;
  }

  private _cacheKey(fontUrl: string, text: string): string {
    return fontUrl + "\0" + text;
  }

  private async _fetchAndLoad(url: string): Promise<void> {
    const client = await this._ensureClient();

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

        // Update atlas once for the entire batch
        if (batchResult.atlas) {
          this._atlasCache.set(fontUrl, batchResult.atlas);
          this._atlasDirty.add(fontUrl);
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
