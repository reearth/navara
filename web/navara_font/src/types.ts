/**
 * Pixel size at which COLRv1 color glyphs are rasterized into the color atlas.
 * Must match `COLOR_GLYPH_PX_SIZE` in `crates/navara_wasm_font_worker/src/color_raster.rs`.
 */
export const COLOR_GLYPH_PX_SIZE = 64.0;

/**
 * Whether the monochrome glyph atlas is rasterized as 4-channel MTSDF
 * (median-of-RGB + true SDF in alpha) instead of single-channel SDF.
 *
 * **Must stay in sync with `ATLAS_MODE` in
 * `crates/navara_wasm_font_worker/src/atlas.rs`.** The shader define
 * `USE_MSDF` is driven from this flag, and the Rust side decides the actual
 * texture layout — if they disagree the atlas will be sampled wrong.
 */
export const USE_MSDF = true;

/**
 * Pixel range over which the atlas distance field ramps from "outside" to
 * "inside" (i.e. the value covered by `d - 0.5` in the shader). This is
 * what converts an outline-thickness expressed in pixels into a delta on
 * the sampled distance value.
 *
 * SDF: `SDF_RADIUS` (35) in `crates/navara_wasm_font_worker/src/atlas.rs`.
 * MSDF: `MSDF_RANGE_PX` (8) in `crates/navara_wasm_font_worker/src/msdf.rs`.
 */
export const ATLAS_RANGE_PX = USE_MSDF ? 8.0 : 35.0;

/** Glyph metrics from either the SDF or the color atlas. */
export type GlyphMetrics = {
  glyphId: number;
  /** Unique font index within the atlas (distinguishes glyphs from different fonts). */
  fontIndex: number;
  /** Pre-computed composite key (font_index, glyph_id) from WASM. */
  compositeKey: bigint;
  atlasX: number;
  atlasY: number;
  atlasW: number;
  atlasH: number;
  bearingX: number;
  bearingY: number;
  /** True when this glyph lives in the COLRv1 color atlas (RGBA) rather than the SDF atlas (R8). */
  isColor: boolean;
};

/** A single shaped glyph with positioning info. */
export type ShapedGlyph = {
  glyphId: number;
  /** Unique font index within the atlas (distinguishes glyphs from different fonts). */
  fontIndex: number;
  /** Pre-computed composite key (font_index, glyph_id) from WASM. */
  compositeKey: bigint;
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

/** SDF/MSDF atlas texture data.
 *
 * `channels` selects the GPU texture format: 1 → R8 (single-channel SDF),
 * 3 → RGB8 (MSDF — sampled with `median(rgb)` in the fragment shader),
 * 4 → RGBA8 (COLRv1 color atlas).
 */
export type FontAtlasData = {
  data: Uint8Array;
  width: number;
  height: number;
  channels: number;
};

export type BatchPrepareTextResult = {
  results: { text: string; shapeResult: ShapeTextResult | null }[];
  /** Snapshot of the SDF atlas, if any glyphs were added during the batch. */
  atlas: FontAtlasData | null;
  /** Snapshot of the COLRv1 color atlas (RGBA), if any color glyphs were added during the batch. */
  colorAtlas: FontAtlasData | null;
  /** The atlas key used for this batch (family name or font URL). */
  atlasKey: string;
};

type UnicodeRange = {
  from: number;
  to: number;
};

export type FontFace = {
  unicodeRanges: UnicodeRange[];
  url: string;
};

export type FontFamily = {
  family: string;
  faces: FontFace[];
};
