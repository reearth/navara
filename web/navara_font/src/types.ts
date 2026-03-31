/** Glyph metrics from the SDF atlas. */
export type GlyphMetrics = {
  glyphId: number;
  /** Unique font index within the atlas (distinguishes glyphs from different fonts). */
  fontIndex: number;
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
  /** Unique font index within the atlas (distinguishes glyphs from different fonts). */
  fontIndex: number;
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
  atlas: FontAtlasData | null;
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
