import type { FontFace, FontFamily, UnicodeRange } from "./types";

/** Filters selecting which `@font-face` blocks of a stylesheet to include. */
export type CssFontFaceFilter = {
  /**
   * Only include blocks whose `font-family` matches one of these names
   * (quotes stripped, case-insensitive). Useful when a stylesheet declares
   * several families and only some should become faces.
   *
   * When given as an array, it also sets face priority: faces are ordered by
   * their family's position in the array (stable within a family). This
   * matters for stylesheets like the Google Fonts CSS API that sort
   * `@font-face` blocks alphabetically regardless of request order — face
   * order decides which face wins for codepoints covered by several faces,
   * and `faces[0]` is the fallback for uncovered codepoints.
   */
  fontFamily?: string | string[];
  /** Only include blocks whose `font-weight` matches, e.g. `800` or `"100 900"`. */
  fontWeight?: string | number;
  /** Only include blocks whose `font-style` matches, e.g. `"normal"` or `"italic"`. */
  fontStyle?: string;
};

export type ParseCssFontFamilyOptions = CssFontFaceFilter & {
  /** Base URL used to resolve relative `src: url(...)` references. */
  baseUrl?: string;
};

export type FetchCssFontFamilyOptions = CssFontFaceFilter & {
  /** Extra `fetch` options (e.g. credentials for a private font host). */
  requestInit?: RequestInit;
};

/**
 * Parse a CSS `unicode-range` descriptor value (e.g. `"U+0-7F, U+131, U+4??"`)
 * into inclusive codepoint ranges. Supports single codepoints (`U+26`),
 * intervals (`U+0102-0103`) and wildcards (`U+4??`).
 */
export function parseCssUnicodeRange(value: string): UnicodeRange[] {
  const ranges: UnicodeRange[] = [];
  for (const token of value.split(",")) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    const match = /^u\+([0-9a-f?]{1,6})(?:-([0-9a-f]{1,6}))?$/i.exec(trimmed);
    if (!match) {
      throw new Error(`Invalid unicode-range token: "${trimmed}"`);
    }
    const [, start, end] = match;
    let range: UnicodeRange;
    if (start.includes("?")) {
      // Wildcard form: `U+4??` means U+400-4FF. A wildcard cannot be
      // combined with an explicit end.
      if (end !== undefined) {
        throw new Error(`Invalid unicode-range token: "${trimmed}"`);
      }
      range = {
        from: parseInt(start.replace(/\?/g, "0"), 16),
        to: parseInt(start.replace(/\?/g, "f"), 16),
      };
    } else {
      const from = parseInt(start, 16);
      range = { from, to: end !== undefined ? parseInt(end, 16) : from };
    }
    if (range.from > range.to || range.to > 0x10ffff) {
      throw new Error(`Invalid unicode-range token: "${trimmed}"`);
    }
    ranges.push(range);
  }
  return ranges;
}

/** A single parsed `@font-face` block's descriptors. */
type CssFontFaceBlock = {
  fontFamily?: string;
  fontStyle?: string;
  fontWeight?: string;
  src?: string;
  unicodeRange?: string;
};

/** Covers every codepoint — used when a block declares no `unicode-range`. */
const FULL_RANGE: UnicodeRange[] = [{ from: 0, to: 0x10ffff }];

function stripQuotes(value: string): string {
  const first = value[0];
  if ((first === '"' || first === "'") && value.endsWith(first)) {
    return value.slice(1, -1);
  }
  return value;
}

/** Extract the font URL from a `src` descriptor, preferring woff2 sources. */
function parseSrcUrl(src: string): string | undefined {
  const sources = [
    ...src.matchAll(
      /url\(\s*("[^"]*"|'[^']*'|[^)]*?)\s*\)(\s*format\(\s*("[^"]*"|'[^']*'|[^)]*?)\s*\))?/gi,
    ),
  ];
  if (sources.length === 0) return undefined;
  const woff2 = sources.find(
    (m) => m[3] && stripQuotes(m[3]).toLowerCase() === "woff2",
  );
  return stripQuotes((woff2 ?? sources[0])[1].trim());
}

function parseFontFaceBlocks(cssText: string): CssFontFaceBlock[] {
  const withoutComments = cssText.replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks: CssFontFaceBlock[] = [];
  for (const [, body] of withoutComments.matchAll(
    /@font-face\s*\{([^}]*)\}/gi,
  )) {
    const block: CssFontFaceBlock = {};
    for (const declaration of body.split(";")) {
      const colon = declaration.indexOf(":");
      if (colon < 0) continue;
      const property = declaration.slice(0, colon).trim().toLowerCase();
      const value = declaration.slice(colon + 1).trim();
      if (property === "font-family") block.fontFamily = stripQuotes(value);
      else if (property === "font-style") block.fontStyle = value;
      else if (property === "font-weight") block.fontWeight = value;
      else if (property === "src") block.src = value;
      else if (property === "unicode-range") block.unicodeRange = value;
    }
    blocks.push(block);
  }
  return blocks;
}

/**
 * Normalize a CSS descriptor value for comparison: CSS keywords are
 * case-insensitive, and whitespace (e.g. in variable-font ranges like
 * `"100 900"`) is insignificant beyond separating tokens.
 */
function normalizeCssValue(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function matchesFilter(
  block: CssFontFaceBlock,
  filter: CssFontFaceFilter,
): boolean {
  if (filter.fontFamily !== undefined) {
    const wanted = Array.isArray(filter.fontFamily)
      ? filter.fontFamily
      : [filter.fontFamily];
    const name = block.fontFamily?.toLowerCase();
    if (!wanted.some((w) => w.toLowerCase() === name)) return false;
  }
  if (
    filter.fontWeight !== undefined &&
    normalizeCssValue(block.fontWeight ?? "") !==
      normalizeCssValue(String(filter.fontWeight))
  ) {
    return false;
  }
  if (
    filter.fontStyle !== undefined &&
    normalizeCssValue(block.fontStyle ?? "") !==
      normalizeCssValue(filter.fontStyle)
  ) {
    return false;
  }
  return true;
}

/**
 * Build a {@link FontFamily} from CSS `@font-face` rules, so faces and their
 * unicode ranges don't have to be written by hand. Each `@font-face` block
 * becomes one face: its `src` URL and its `unicode-range` (faces stay
 * lazily downloaded — a face is only fetched once text actually needs a
 * codepoint in its ranges). Blocks without a `unicode-range` cover all
 * codepoints.
 *
 * Face priority follows CSS semantics: later `@font-face` rules take
 * precedence when their unicode-ranges overlap, so faces come out in
 * reverse stylesheet order (use the `fontFamily` array to order families
 * explicitly). The resulting first face doubles as the fallback for
 * codepoints no face covers — same semantics as a hand-written
 * {@link FontFamily}.
 *
 * @param family Family name to register the faces under.
 * @param cssText Stylesheet text containing `@font-face` rules.
 * @param options Optional block filters and a `baseUrl` for relative URLs.
 */
export function parseFontFamilyFromCss(
  family: string,
  cssText: string,
  options: ParseCssFontFamilyOptions = {},
): FontFamily {
  const faces: { face: FontFace; cssFamily: string }[] = [];
  for (const block of parseFontFaceBlocks(cssText)) {
    if (!matchesFilter(block, options)) continue;
    if (block.src === undefined) continue;
    const rawUrl = parseSrcUrl(block.src);
    if (rawUrl === undefined) continue;
    const url = options.baseUrl
      ? new URL(rawUrl, options.baseUrl).toString()
      : rawUrl;
    const unicodeRanges = block.unicodeRange
      ? parseCssUnicodeRange(block.unicodeRange)
      : FULL_RANGE;
    faces.push({
      face: { url, unicodeRanges },
      cssFamily: block.fontFamily?.toLowerCase() ?? "",
    });
  }
  if (faces.length === 0) {
    throw new Error(
      `parseFontFamilyFromCss: no @font-face rules matched for family "${family}"`,
    );
  }
  // CSS gives LATER @font-face rules precedence when their unicode-ranges
  // overlap, so reverse the block order. Stylesheets rely on this: e.g.
  // Google Fonts' `latin-ext` block declares broad ranges (U+0100-024F)
  // that include codepoints only present in the `latin` file declared
  // after it — without the reversal those codepoints would route to a face
  // missing the glyph and shape as tofu.
  faces.reverse();
  if (Array.isArray(options.fontFamily)) {
    // Some stylesheets (e.g. the Google Fonts CSS API) order @font-face
    // blocks alphabetically, so restore the priority the caller asked for.
    const priority = options.fontFamily.map((name) => name.toLowerCase());
    faces.sort(
      (a, b) => priority.indexOf(a.cssFamily) - priority.indexOf(b.cssFamily),
    );
  }
  return { family, faces: faces.map(({ face }) => face) };
}

/**
 * Fetch one or more stylesheets and build a {@link FontFamily} from their
 * `@font-face` rules — see {@link parseFontFamilyFromCss}. Only the CSS is
 * downloaded here; font files stay lazily fetched per face as text needs
 * them.
 *
 * Works directly with the Google Fonts CSS API, which declares one
 * `@font-face` per script subset with `unicode-range` (CJK families are
 * split into ~100 lazily-loaded slices):
 *
 * ```ts
 * const family = await fetchFontFamilyFromCss(
 *   "labels",
 *   "https://fonts.googleapis.com/css2?family=Archivo:wght@800&family=Noto+Sans+JP:wght@800",
 * );
 * view.addFontFamily(family);
 * ```
 *
 * When passing multiple URLs, face priority follows URL order, then block
 * order within each stylesheet.
 *
 * @param family Family name to register the faces under.
 * @param cssUrl Stylesheet URL(s) to fetch.
 * @param options Optional block filters and fetch options.
 */
export async function fetchFontFamilyFromCss(
  family: string,
  cssUrl: string | string[],
  options: FetchCssFontFamilyOptions = {},
): Promise<FontFamily> {
  const urls = Array.isArray(cssUrl) ? cssUrl : [cssUrl];
  const { requestInit, ...filter } = options;
  const faces: FontFace[] = [];
  const cssTexts = await Promise.all(
    urls.map(async (url) => {
      const response = await fetch(url, requestInit);
      if (!response.ok) {
        throw new Error(
          `fetchFontFamilyFromCss: failed to fetch "${url}" (${response.status})`,
        );
      }
      // response.url follows redirects, making it the right base for
      // relative src URLs.
      return { text: await response.text(), baseUrl: response.url || url };
    }),
  );
  for (const { text, baseUrl } of cssTexts) {
    faces.push(
      ...parseFontFamilyFromCss(family, text, { ...filter, baseUrl }).faces,
    );
  }
  return { family, faces };
}
