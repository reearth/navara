import type { Core } from "@navara/engine";
import {
  DataTexture,
  LinearFilter,
  RedFormat,
  UnsignedByteType,
} from "three";

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
 * Wraps the WASM font API (loadFont, shapeText, getFontAtlas)
 * and handles font file fetching from URLs.
 */
export class FontManager {
  private _core: Core | undefined;
  /** Tracks in-flight fetch promises to avoid duplicate requests. */
  private _pending = new Map<string, Promise<void>>();
  /** Tracks fonts that have been successfully loaded. */
  private _loaded = new Set<string>();
  /** Cache shaped text results to avoid redundant WASM calls. Key: "fontUrl\0text" */
  private _shapeCache = new Map<string, ShapeTextResult>();
  /** Cache atlas data per font to avoid redundant 1MB copies. */
  private _atlasCache = new Map<string, FontAtlasData>();
  /** Tracks whether the atlas cache is stale (new glyphs may have been rasterized). */
  private _atlasDirty = new Set<string>();
  /** Tracks known rasterized glyph IDs per font to avoid unnecessary atlas re-copies. */
  private _knownGlyphs = new Map<string, Set<number>>();
  /** Shared GPU texture per font — all meshes using the same font share one DataTexture. */
  private _textureCache = new Map<string, DataTexture>();

  setCore(core: Core) {
    this._core = core;
  }

  /**
   * Load a font from a URL. Fetches the font file and sends it to the WASM engine.
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
    if (this._loaded.has(url)) return true;
    // Also check WASM side in case font was loaded through another path
    return this._core?.isFontLoaded(url) ?? false;
  }

  /**
   * Shape text with a loaded font.
   * Returns glyph positions and atlas metrics, or undefined if the font isn't loaded.
   * This also ensures all shaped glyphs are rasterized into the font's atlas.
   */
  shapeText(fontUrl: string, text: string): ShapeTextResult | undefined {
    if (!this._core) return undefined;

    const cacheKey = fontUrl + "\0" + text;
    const cached = this._shapeCache.get(cacheKey);
    if (cached) return cached;

    const result = this._core.shapeText(fontUrl, text);
    if (!result) return undefined;

    const glyphs: ShapedGlyph[] = result.glyphs.map((g) => ({
      glyphId: g.glyph_id,
      xAdvance: g.x_advance,
      yAdvance: g.y_advance,
      xOffset: g.x_offset,
      yOffset: g.y_offset,
      cluster: g.cluster,
    }));

    const metrics: GlyphMetrics[] = result.metrics.map((m) => ({
      glyphId: m.glyph_id,
      atlasX: m.atlas_x,
      atlasY: m.atlas_y,
      atlasW: m.atlas_w,
      atlasH: m.atlas_h,
      bearingX: m.bearing_x,
      bearingY: m.bearing_y,
      advance: m.advance,
    }));

    const shaped = { glyphs, metrics, unitsPerEm: result.units_per_em ?? 1000 };
    this._shapeCache.set(cacheKey, shaped);

    // Only mark atlas dirty if shapeText introduced glyphs we haven't seen before.
    // After ~20 unique labels, all Latin characters are covered and no more atlas copies needed.
    let knownSet = this._knownGlyphs.get(fontUrl);
    if (!knownSet) {
      knownSet = new Set();
      this._knownGlyphs.set(fontUrl, knownSet);
    }
    let hasNewGlyphs = false;
    for (const m of metrics) {
      if (!knownSet.has(m.glyphId)) {
        knownSet.add(m.glyphId);
        hasNewGlyphs = true;
      }
    }
    if (hasNewGlyphs) {
      this._atlasDirty.add(fontUrl);
    }

    return shaped;
  }

  /** Get the units-per-em value for a loaded font. */
  getUnitsPerEm(fontUrl: string): number | undefined {
    if (!this._core) return undefined;
    return this._core.getUnitsPerEm?.(fontUrl) ?? undefined;
  }

  /** Get the SDF atlas data for a loaded font. Returns cached data when possible. */
  getAtlas(fontUrl: string): FontAtlasData | undefined {
    if (!this._core) return undefined;

    // Return cached atlas if not stale
    if (!this._atlasDirty.has(fontUrl)) {
      const cached = this._atlasCache.get(fontUrl);
      if (cached) return cached;
    }

    const atlas = this._core.getFontAtlas(fontUrl);
    if (!atlas) return undefined;

    const atlasData: FontAtlasData = {
      data: new Uint8Array(atlas.data),
      width: atlas.width,
      height: atlas.height,
    };
    this._atlasCache.set(fontUrl, atlasData);
    this._atlasDirty.delete(fontUrl);
    return atlasData;
  }

  /**
   * Get a shared GPU DataTexture for a font's atlas.
   * Returns the same texture instance for all callers using the same font.
   * Creates the texture on first call; updates it in-place when the atlas grows.
   */
  getAtlasTexture(fontUrl: string): DataTexture | null {
    const atlasData = this.getAtlas(fontUrl);
    if (!atlasData) return null;

    const existing = this._textureCache.get(fontUrl);
    if (existing) {
      // Update in-place if atlas data changed (getAtlas returns new data when dirty)
      existing.image = { data: atlasData.data, width: atlasData.width, height: atlasData.height };
      existing.needsUpdate = true;
      return existing;
    }

    const tex = new DataTexture(atlasData.data, atlasData.width, atlasData.height, RedFormat, UnsignedByteType);
    tex.minFilter = LinearFilter;
    tex.magFilter = LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    this._textureCache.set(fontUrl, tex);
    return tex;
  }

  dispose() {
    this._pending.clear();
    this._loaded.clear();
    this._shapeCache.clear();
    this._atlasCache.clear();
    this._atlasDirty.clear();
    this._knownGlyphs.clear();
    for (const tex of this._textureCache.values()) {
      tex.dispose();
    }
    this._textureCache.clear();
    this._core = undefined;
  }

  private async _fetchAndLoad(url: string): Promise<void> {
    console.log(`FontManager: fetching font from ${url}`);
    const core = this._core;
    if (!core) throw new Error("FontManager: core not initialized");

    const response = await fetch(url, { priority: "low" });
    if (!response.ok) {
      throw new Error(`FontManager: failed to fetch font from ${url}: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const ok = core.loadFont(url, bytes.length, (buf: Uint8Array) => {
      buf.set(bytes);
    });

    if (!ok) {
      throw new Error(`FontManager: WASM failed to load font from ${url}`);
    }
  }
}
