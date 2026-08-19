/**
 * The font stack this demo registers, and the Overture label style it
 * reproduces. Kept in its own module because it is *data*, not API usage — the
 * Navara calls that consume it stay visible in `run.ts`.
 *
 * Ported from the `pmtiles-overture` example so the two pages render labels
 * identically; the comments explaining *why* each choice is made are preserved
 * here because this page exists to be read during a talk.
 */

/**
 * Family names the label faces are registered under. Two, because the official
 * Overture style uses a different weight for administrative names than for place
 * names, and a Navara font family maps codepoints to faces by unicode range —
 * not by weight — so one weight per registered family.
 */
export const ADMIN_FAMILY = "OvertureAdminLabels";
export const PLACE_FAMILY = "OverturePlaceLabels";

/**
 * Weights taken from the official Overture explorer style
 * (explore.overturemaps.org). Its `$globals.font` block resolves to
 * "Noto Sans SemiCondensed" in three weights, referenced as:
 *   primary   = SemiCondensed Bold    (700) — countries, regions, counties,
 *                                             localities over 1M population
 *   secondary = SemiCondensed Medium  (500) — smaller localities, boroughs
 *   tertiary  = SemiCondensed Regular (400) — filtered places (POI)
 * This demo collapses each layer to one weight: admin labels take primary,
 * place labels take tertiary.
 */
export const ADMIN_WEIGHT = 700;
export const PLACE_WEIGHT = 400;

/**
 * Latin face. Overture's glyph server exposes "Noto Sans SemiCondensed" as a
 * named face; on the Google Fonts CSS API the same design is the `wdth` axis of
 * variable Noto Sans at 87.5 (100 = normal, 75 = Condensed).
 */
const LATIN_FAMILY = "Noto Sans";
const latinFace = (weight: number) =>
  `${LATIN_FAMILY}:wdth,wght@87.5,${weight}`;

/**
 * Non-Latin faces covering the scripts Overture place names use, in priority
 * order. `variable: false` marks families Google publishes at a single weight —
 * appending a `wght` axis they don't have makes the whole CSS request fail with
 * HTTP 400, taking every other family down with it.
 *
 * Order matters: for each codepoint the first face whose declared ranges contain
 * it wins, and Google's declared ranges are per-subset boilerplate that can
 * claim codepoints a font doesn't actually contain (which would shape as tofu).
 * This order was verified against the fonts' real coverage:
 * - Bengali/Devanagari/Armenian/Gurmukhi/Syriac lead the script list, ahead of
 *   the remaining families that declare (but lack) some of their signs.
 *   Note they do NOT outrank plain Noto Sans, which heads the whole stack (see
 *   `FAMILY_NAMES`) and ships its own devanagari/bengali/gurmukhi subsets —
 *   verified to shape those scripts correctly, conjuncts included.
 * - Noto Sans and JP/KR precede the remaining script fonts so shared
 *   symbols/punctuation resolve to fonts that really contain them.
 * - SC and Mongolian go last: Google slices them like CJK fonts whose declared
 *   ranges also claim Hiragana, Hangul, Armenian, Arabic, Thai, Cherokee, and
 *   more that these fonts don't cover.
 */
const SCRIPT_FACES: { family: string; variable?: boolean }[] = [
  { family: "Noto Sans Bengali" },
  { family: "Noto Sans Devanagari" },
  { family: "Noto Sans Armenian" },
  { family: "Noto Sans Gurmukhi" },
  { family: "Noto Sans Arabic" },
  { family: "Noto Sans Syriac" },
  // No plain "Noto Sans" entry: `latinFace` already requests that family with
  // the `wdth` axis pinned to 87.5. Asking for both merges into one family in
  // the CSS response, emitting the same unicode-ranges at 87.5% *and* 100%
  // width, after which face selection per codepoint is a coin flip between
  // SemiCondensed and normal.
  { family: "Noto Sans JP" },
  { family: "Noto Sans KR" },
  { family: "Noto Sans Hebrew" },
  { family: "Noto Sans Thaana" },
  { family: "Noto Sans NKo", variable: false },
  { family: "Noto Sans Thai" },
  { family: "Noto Sans Lao" },
  { family: "Noto Sans Khmer" },
  { family: "Noto Sans Myanmar" },
  { family: "Noto Sans Gujarati" },
  { family: "Noto Sans Tamil" },
  { family: "Noto Sans Telugu" },
  { family: "Noto Sans Kannada" },
  { family: "Noto Sans Malayalam" },
  { family: "Noto Sans Oriya" },
  { family: "Noto Sans Sinhala" },
  { family: "Noto Sans Georgian" },
  { family: "Noto Sans Ethiopic" },
  { family: "Noto Serif Tibetan" },
  { family: "Noto Sans Tifinagh", variable: false },
  { family: "Noto Sans Adlam" },
  { family: "Noto Sans Cherokee" },
  { family: "Noto Sans Canadian Aboriginal" },
  { family: "Noto Sans Vai", variable: false },
  { family: "Noto Sans Yi", variable: false },
  { family: "Noto Sans Osmanya", variable: false },
  { family: "Noto Sans SC" },
  { family: "Noto Sans Mongolian", variable: false },
];

/** Plain family names in priority order, Latin first. */
export const FAMILY_NAMES: string[] = [
  LATIN_FAMILY,
  ...SCRIPT_FACES.map(({ family }) => family),
];

/** Google Fonts CSS API specs for one weight, Latin face first. */
const fontStack = (weight: number): string[] => [
  latinFace(weight),
  ...SCRIPT_FACES.map(({ family, variable }) =>
    variable === false ? family : `${family}:wght@${weight}`,
  ),
];

export const cssUrl = (weight: number) =>
  `https://fonts.googleapis.com/css2?${fontStack(weight)
    .map((family) => `family=${family.replace(/ /g, "+")}`)
    .join("&")}`;

/**
 * Label colors, resolved from the Overture explorer's style variables through
 * `$semantic` to `$globals.color`:
 *   admin text  `$semantic.division.label` = gray.900  hsl(0 0% 18%)
 *   admin halo  `$semantic.division.halo`  = white 80% hsla(0 0% 100% / 0.8)
 *   place text  `$semantic.place.label`    = gray.950  hsl(0 0% 11%)
 *   place halo  `$semantic.place.labelHalo`= white 30% hsla(0 0% 100% / 0.3)
 */
export const OVERTURE_COLORS = {
  adminText: "#2e2e2e",
  adminHalo: "#ffffff",
  adminHaloOpacity: 0.8,
  placeText: "#1c1c1c",
  placeHalo: "#ffffff",
  placeHaloOpacity: 0.3,
} as const;

/**
 * Overture states halos as `text-halo-width` in *screen* pixels, constant across
 * text sizes. Navara's `outlineWidth` is em-relative instead: the value is
 * texels at the 64 px/em reference density, so it dilates by `w / 64` em (see
 * `atlasRangePx` in `@navaramap/font`). Converting needs the text size the halo
 * was authored against:
 *
 *   outlineWidth = haloPx / textSize * 64
 *
 * Overture's admin halos land near the same em value at their own sizes —
 * 1.2 px at size 19 (country), 1.5 px at 24 (locality), 1.1 px at 15 (region)
 * all come to ~0.065 em — so one number reproduces them: 0.065 * 64 ≈ 4.
 * Their filtered-place halo is proportionally much heavier: 1.5 px at size 12 is
 * 0.125 em, hence 8.
 */
export const ADMIN_OUTLINE_WIDTH = 4;
export const PLACE_OUTLINE_WIDTH = 8;

/**
 * Navara has no independent pixel offset for billboard/text materials. An en
 * space at the fixed 12 px POI label size gives the icon/label pair a consistent
 * visual gap while keeping both halves anchored to the same geographic point.
 */
export const POI_LABEL_GAP = " ";
