---
title: Font Family from CSS
description: API Reference for building font families from CSS @font-face rules
sidebar:
  order: 1020
---

These utilities build a `FontFamily` (see [`addFontFamily()`](../../../three/api/threeview-functions/#addfontfamily)) from CSS `@font-face` rules, so faces and their unicode ranges don't have to be written by hand. Each `@font-face` block becomes one face, taking its `src` URL and its `unicode-range`. Font files stay lazily downloaded: only the stylesheet is fetched up front, and each face file is downloaded the first time a label needs one of its codepoints.

They work with any stylesheet that declares `@font-face` rules with `unicode-range`, such as the [Google Fonts CSS API](https://developers.google.com/fonts/docs/css2), self-hosted stylesheets, or font packages on CDNs.

## Basic Usage

```typescript
import ThreeView, { fetchFontFamilyFromCss } from "@navaramap/three";

const view = new ThreeView({ container: element });
await view.init();

view.addFontFamily(
  await fetchFontFamilyFromCss(
    "MapFont",
    "https://fonts.googleapis.com/css2?family=Archivo:wght@800&family=Noto+Sans+JP:wght@800",
  ),
);

// Later, in a text layer material:
// text: { font: "MapFont" }
```

## Face Priority

For each codepoint, the first face whose unicode ranges contain it wins, so face order matters. The parsed faces follow CSS semantics: later `@font-face` rules take precedence when their unicode ranges overlap, so faces come out in reverse stylesheet order. Stylesheets rely on this — for example, Google Fonts' `latin-ext` block declares broad ranges that include codepoints only present in the `latin` file declared after it.

To control priority across families, pass the family names as an array in the `fontFamily` option. Faces are then ordered by their family's position in the array. This matters for stylesheets like the Google Fonts CSS API that sort `@font-face` blocks alphabetically regardless of request order:

```typescript
const family = await fetchFontFamilyFromCss("MapFont", cssUrl, {
  // Priority order: JP wins codepoints shared across the CJK subsets.
  fontFamily: ["Archivo", "Noto Sans JP", "Noto Sans SC", "Noto Sans KR"],
});
```

:::note
Some stylesheets declare unicode ranges a font file does not fully cover (for example, shared per-subset boilerplate ranges). A codepoint routed to a face missing the glyph renders as tofu (□). If that happens, order the family whose font really contains the codepoints earlier via the `fontFamily` array.
:::

## Functions

### fetchFontFamilyFromCss()

Fetches one or more stylesheets and builds a `FontFamily` from their `@font-face` rules. Relative `src` URLs are resolved against the stylesheet URL (after redirects).

**Syntax:**

```typescript
fetchFontFamilyFromCss(
  family: string,
  cssUrl: string | string[],
  options?: FetchCssFontFamilyOptions,
): Promise<FontFamily>
```

**Parameters:**

- `family`: Family name to register the faces under; referenced from `material.font`.
- `cssUrl`: Stylesheet URL(s) to fetch. With multiple URLs, face priority follows URL order, then block order within each stylesheet.
- `options`: Optional [block filters](#cssfontfacefilter-type) and `requestInit` (extra `fetch` options, e.g. credentials for a private font host).

**Returns:**

A promise resolving to the parsed `FontFamily`.

**Example:**

```typescript
import { fetchFontFamilyFromCss } from "@navaramap/three";

// Combine a self-hosted stylesheet with a font package's own stylesheet.
const family = await fetchFontFamilyFromCss("CityWithEmoji", [
  "/fonts/world-cities.css",
  "https://cdn.jsdelivr.net/npm/@infolektuell/noto-color-emoji@0.2.0/index.css",
]);
view.addFontFamily(family);
```

### parseFontFamilyFromCss()

Builds a `FontFamily` from stylesheet text. Use this when the CSS is inlined or fetched separately. Throws if no `@font-face` rule matches the filters.

**Syntax:**

```typescript
parseFontFamilyFromCss(
  family: string,
  cssText: string,
  options?: ParseCssFontFamilyOptions,
): FontFamily
```

**Parameters:**

- `family`: Family name to register the faces under.
- `cssText`: Stylesheet text containing `@font-face` rules.
- `options`: Optional [block filters](#cssfontfacefilter-type) and `baseUrl` (base URL used to resolve relative `src: url(...)` references).

**Returns:**

The parsed `FontFamily`.

**Example:**

```typescript
import { parseFontFamilyFromCss } from "@navaramap/three";

const family = parseFontFamilyFromCss(
  "MapFont",
  `@font-face {
    font-family: "Latin";
    src: url(./fonts/latin.woff2) format("woff2");
    unicode-range: U+0000-00FF, U+0131;
  }`,
  { baseUrl: "https://example.com/styles/fonts.css" },
);
```

### parseCssUnicodeRange()

Parses a CSS `unicode-range` descriptor value into inclusive codepoint ranges. Supports single codepoints (`U+26`), intervals (`U+0102-0103`), and wildcards (`U+4??`). Throws on malformed tokens.

**Syntax:**

```typescript
parseCssUnicodeRange(value: string): UnicodeRange[]
```

**Parameters:**

- `value`: A `unicode-range` descriptor value, e.g. `"U+0-7F, U+131, U+4??"`.

**Returns:**

An array of `{ from, to }` codepoint ranges (inclusive).

**Example:**

```typescript
import { parseCssUnicodeRange } from "@navaramap/three";

parseCssUnicodeRange("U+0102-0103, U+20AB");
// [{ from: 0x0102, to: 0x0103 }, { from: 0x20ab, to: 0x20ab }]
```

## CssFontFaceFilter Type

Filters selecting which `@font-face` blocks of a stylesheet become faces. Available on both functions.

- `fontFamily`: Only include blocks whose `font-family` matches (quotes stripped, case-insensitive). When given as an array, it also sets face priority — see [Face Priority](#face-priority).
- `fontWeight`: Only include blocks whose `font-weight` matches, e.g. `800` or `"100 900"`.
- `fontStyle`: Only include blocks whose `font-style` matches, e.g. `"normal"` or `"italic"`.

```typescript
type CssFontFaceFilter = {
  fontFamily?: string | string[];
  fontWeight?: string | number;
  fontStyle?: string;
};

type ParseCssFontFamilyOptions = CssFontFaceFilter & { baseUrl?: string };

type FetchCssFontFamilyOptions = CssFontFaceFilter & {
  requestInit?: RequestInit;
};
```
