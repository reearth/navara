/**
 * Pixel size at which COLRv1 color glyphs are rasterized into the color atlas.
 * Must match `COLOR_GLYPH_PX_SIZE` in `crates/navara_wasm_font_worker/src/color_raster.rs`.
 */
export const COLOR_GLYPH_PX_SIZE = 64.0;

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

// ---------------------------------------------------------------------------
// Slug-style curve pipeline types (parallel to the SDF types above).
//
// These mirror the Phase 1–3 Rust output. The shape result no longer carries
// atlas rects; instead each glyph carries a `headerSlot` that the vertex
// shader uses to fetch the glyph's bbox, band table, and curve table from
// shared GPU buffers (see CurveTextureSet).
// ---------------------------------------------------------------------------

/** A single shaped glyph in the curve pipeline. */
export type CurveShapedGlyph = {
  glyphId: number;
  fontIndex: number;
  /** Slot index in the outline atlas's `glyphHeaders` buffer. The vertex
   *  shader uses this as the instance attribute. */
  headerSlot: number;
  xAdvance: number;
  yAdvance: number;
  xOffset: number;
  yOffset: number;
};

/** Result of shaping text through the curve pipeline. */
export type ShapeTextCurvesResult = {
  glyphs: CurveShapedGlyph[];
  unitsPerEm: number;
  /** True iff this run shaped through a COLRv1 face. */
  isColor: boolean;
};

/** Dirty range [start, end) (in *element* units, not bytes) on a single
 *  GPU-resident buffer. `null` means the buffer didn't change this batch. */
export type CurveDirtyRange = { start: number; end: number } | null;

/** Snapshot of the four outline-pipeline buffers for one atlas key. */
export type CurveBufferSnapshot = {
  /** 12 f32 per glyph header slot. RGBA32F-friendly. */
  glyphHeaders: Float32Array;
  /** 1 u32 per band entry: `(curveStart << 16) | curveCount`. */
  bandData: Uint32Array;
  /** 1 u32 per band-curves entry (glyph-local curve index). */
  bandCurves: Uint32Array;
  /** 6 f32 per quadratic Bezier: p0.xy, p1.xy, p2.xy. */
  curveData: Float32Array;
  dirty: {
    headers: CurveDirtyRange;
    bandData: CurveDirtyRange;
    bandCurves: CurveDirtyRange;
    curveData: CurveDirtyRange;
  };
};

/** Snapshot of the three COLRv1-pipeline buffers for one atlas key. */
export type ColorCurveBufferSnapshot = {
  /** 12 u32 per layer header (transform-as-bits + tags + offsets). */
  layerHeaders: Uint32Array;
  /** Variable f32 blob; per-layer layout depends on the layer's paint tag. */
  paintParams: Float32Array;
  /** 8 u32 per clip record. */
  clipRecords: Uint32Array;
  dirty: {
    layerHeaders: CurveDirtyRange;
    paintParams: CurveDirtyRange;
    clipRecords: CurveDirtyRange;
  };
};

/** Per-batch return value for the curve pipeline. The buffer snapshots are
 *  only present when at least one of their sub-buffers changed during the
 *  batch — `null` means JS keeps using the previously cached snapshot. */
export type BatchPrepareTextCurvesResult = {
  results: {
    text: string;
    shapeResult: ShapeTextCurvesResult | null;
  }[];
  atlasKey: string;
  outline: CurveBufferSnapshot | null;
  color: ColorCurveBufferSnapshot | null;
};
