import type { ConcurrencyManager } from "@navara/worker";
import { DataTexture, LinearFilter, RedFormat, UnsignedByteType } from "three";

import { FontWorkerClient } from "./FontWorkerClient";
import { LRUMap } from "./LRUMap";
import type {
  FontAtlasData,
  FontFace,
  FontFamily,
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
  /** Caches resolved font URL per (fontIdentifier, text) pair. */
  private _resolvedUrls = new Map<string, string>();
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

  /** Remove a registered font family. */
  unregisterFontFamily(family: string): void {
    this._families.delete(family);
  }

  /** Check whether a font identifier is a registered family name. */
  isFamily(fontIdentifier: string): boolean {
    return this._families.has(fontIdentifier);
  }

  /**
   * Resolve a font identifier to a concrete font URL.
   * If the identifier is a registered family name, picks the best-matching
   * face based on unicode range coverage of the text's codepoints.
   * Otherwise returns the identifier as-is (assumed to be a URL).
   */
  private _resolveFontUrl(fontIdentifier: string, text: string): string {
    const family = this._families.get(fontIdentifier);
    if (!family) return fontIdentifier;

    const cacheKey = this._cacheKey(fontIdentifier, text);
    const cached = this._resolvedUrls.get(cacheKey);
    if (cached) return cached;

    const url = this._pickBestFace(family.faces, text);
    this._resolvedUrls.set(cacheKey, url);
    return url;
  }

  /**
   * Pick the font face whose unicode ranges cover the most codepoints in the text.
   * Falls back to the first face if none match.
   */
  private _pickBestFace(faces: FontFace[], text: string): string {
    if (faces.length === 0) {
      throw new Error("FontManager: font family has no faces");
    }
    if (faces.length === 1) return faces[0].url;

    let bestUrl = faces[0].url;
    let bestCount = 0;

    for (const face of faces) {
      let count = 0;
      for (const ch of text) {
        const cp = ch.codePointAt(0);
        if (cp === undefined) continue;
        for (const range of face.unicodeRanges) {
          if (cp >= range.from && cp <= range.to) {
            count++;
            break;
          }
        }
      }
      if (count > bestCount) {
        bestCount = count;
        bestUrl = face.url;
      }
    }

    return bestUrl;
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
   */
  async prepareText(fontIdentifier: string, text: string): Promise<void> {
    if (!text) return;

    const fontUrl = this._resolveFontUrl(fontIdentifier, text);

    // Ensure the resolved font is loaded. When loading a family face,
    // pass the family name as atlas key so all faces share one atlas.
    const atlasKey = this._families.has(fontIdentifier)
      ? fontIdentifier
      : undefined;
    await this.loadFont(fontUrl, atlasKey);

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

  /**
   * Check if text has been prepared (sync).
   * Accepts either a font URL or a registered font family name.
   */
  isTextPrepared(fontIdentifier: string, text: string): boolean {
    const fontUrl = this._resolveFontUrl(fontIdentifier, text);
    return this._shapeCache.get(fontUrl)?.has(text) ?? false;
  }

  /**
   * Get shaped text from cache. Returns undefined if not yet prepared.
   * Call prepareText() first.
   * Accepts either a font URL or a registered font family name.
   */
  shapeText(fontIdentifier: string, text: string): ShapeTextResult | undefined {
    const fontUrl = this._resolveFontUrl(fontIdentifier, text);
    return this._shapeCache.get(fontUrl)?.get(text);
  }

  /**
   * Get the SDF atlas data for a loaded font from cache.
   * Accepts either a font URL or a registered font family name.
   * For families, the atlas is shared across all faces.
   */
  getAtlas(fontIdentifier: string, text?: string): FontAtlasData | undefined {
    const key = this._resolveAtlasKey(fontIdentifier, text);
    return this._atlasCache.get(key);
  }

  /**
   * Get a shared GPU DataTexture for a font's atlas.
   * Returns the same texture instance for all callers using the same font.
   * Creates the texture on first call; updates it in-place when the atlas grows.
   * Accepts either a font URL or a registered font family name.
   * For families, all faces share the same texture.
   */
  getAtlasTexture(fontIdentifier: string, text?: string): DataTexture | null {
    const key = this._resolveAtlasKey(fontIdentifier, text);

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

  /**
   * Resolve a font identifier + text to the concrete font URL.
   * Useful for callers that need the resolved URL (e.g., for atlas texture lookups).
   */
  resolvedFontUrl(fontIdentifier: string, text: string): string {
    return this._resolveFontUrl(fontIdentifier, text);
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
    this._resolvedUrls.clear();
    this._atlasKeys.clear();
    this._client?.dispose();
    this._client = undefined;
  }

  private _cacheKey(fontUrl: string, text: string): string {
    return fontUrl + "\0" + text;
  }

  /** Resolve a font identifier to its atlas key.
   *  Family names are their own atlas key; font URLs are looked up via _atlasKeys. */
  private _resolveAtlasKey(fontIdentifier: string, text?: string): string {
    // If it's a registered family name, that IS the atlas key
    if (this._families.has(fontIdentifier)) return fontIdentifier;
    // For font URLs, resolve via the atlas key map (falls back to URL itself)
    const fontUrl = text
      ? this._resolveFontUrl(fontIdentifier, text)
      : fontIdentifier;
    return this._atlasKeys.get(fontUrl) ?? fontUrl;
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
