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

/** SDF atlas texture data. */
export type FontAtlasData = {
  data: Uint8Array;
  width: number;
  height: number;
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
