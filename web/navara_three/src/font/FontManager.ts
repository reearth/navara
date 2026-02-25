import type { Core } from "@navara/engine";

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

    return { glyphs, metrics, unitsPerEm: result.units_per_em ?? 1000 };
  }

  /** Get the units-per-em value for a loaded font. */
  getUnitsPerEm(fontUrl: string): number | undefined {
    if (!this._core) return undefined;
    return this._core.getUnitsPerEm?.(fontUrl) ?? undefined;
  }

  /** Get the SDF atlas data for a loaded font. */
  getAtlas(fontUrl: string): FontAtlasData | undefined {
    if (!this._core) return undefined;

    const atlas = this._core.getFontAtlas(fontUrl);
    if (!atlas) return undefined;

    return {
      data: new Uint8Array(atlas.data),
      width: atlas.width,
      height: atlas.height,
    };
  }

  dispose() {
    this._pending.clear();
    this._loaded.clear();
    this._core = undefined;
  }

  private async _fetchAndLoad(url: string): Promise<void> {
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
