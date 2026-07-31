/**
 * Screen-size thresholds for the distance-field text shader.
 *
 * A single distance lookup is sufficient while a glyph has enough screen
 * pixels for every stroke to own several fragments. Below that point, a CJK
 * glyph can place multiple contours inside one fragment footprint, so the
 * shader averages four subpixel coverage evaluations. The blend interval keeps
 * animated/world-sized labels from popping as their projected size changes.
 */
export const SMALL_TEXT_SUPERSAMPLE_FULL_PPEM = 24;
export const SMALL_TEXT_SUPERSAMPLE_END_PPEM = 32;

/**
 * Expand the fill contour slightly at tiny display sizes. This is the
 * distance-field equivalent of stem darkening: it prevents a nominally
 * one-pixel stroke from becoming a low-contrast gray line after correct area
 * antialiasing. The adjustment is in screen pixels per side and disappears
 * before normal-size text, so layout and atlas geometry remain unchanged.
 */
export const SMALL_TEXT_STEM_DARKEN_MAX_PX = 0.15;
export const SMALL_TEXT_STEM_DARKEN_FULL_PPEM = 12;
export const SMALL_TEXT_STEM_DARKEN_END_PPEM = 32;

/**
 * MTSDF's RGB median preserves corners at normal sizes, but under strong
 * minification its independently filtered channels can select the wrong edge.
 * The alpha channel is a true SDF, so use it at small sizes and blend back to
 * RGB as the glyph gains enough screen pixels.
 */
export const MSDF_TRUE_SDF_END_PPEM = 16;
export const MSDF_FULL_DETAIL_PPEM = 32;
