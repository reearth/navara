import { describe, it, expect, afterEach, vi } from "vitest";

import {
  fetchFontFamilyFromCss,
  parseCssUnicodeRange,
  parseFontFamilyFromCss,
} from "./cssFontFamily";

// Trimmed-down Google Fonts CSS API response: two subsets of one family plus
// a second family, each block with its own unicode-range.
const GOOGLE_FONTS_CSS = `
/* vietnamese */
@font-face {
  font-family: 'Archivo';
  font-style: normal;
  font-weight: 800;
  font-stretch: 125%;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/archivo/v25/viet.woff2) format('woff2');
  unicode-range: U+0102-0103, U+0110-0111, U+1EA0-1EF9, U+20AB;
}
/* latin */
@font-face {
  font-family: 'Archivo';
  font-style: normal;
  font-weight: 800;
  font-stretch: 125%;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/archivo/v25/latin.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+2000-206F;
}
/* [58] */
@font-face {
  font-family: 'Noto Sans JP';
  font-style: normal;
  font-weight: 800;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/notosansjp/v56/slice.58.woff2) format('woff2');
  unicode-range: U+4E00-4EFF;
}
`;

describe("parseCssUnicodeRange", () => {
  it("parses single codepoints, intervals, and wildcards", () => {
    expect(parseCssUnicodeRange("U+26")).toEqual([{ from: 0x26, to: 0x26 }]);
    expect(parseCssUnicodeRange("U+0102-0103, U+20AB")).toEqual([
      { from: 0x102, to: 0x103 },
      { from: 0x20ab, to: 0x20ab },
    ]);
    expect(parseCssUnicodeRange("U+4??")).toEqual([{ from: 0x400, to: 0x4ff }]);
    expect(parseCssUnicodeRange("u+1ea0-1ef9")).toEqual([
      { from: 0x1ea0, to: 0x1ef9 },
    ]);
  });

  it("rejects malformed tokens", () => {
    expect(() => parseCssUnicodeRange("0102-0103")).toThrow();
    expect(() => parseCssUnicodeRange("U+GGGG")).toThrow();
    expect(() => parseCssUnicodeRange("U+4??-4FF")).toThrow();
  });
});

describe("parseFontFamilyFromCss", () => {
  it("builds one face per @font-face block, in reverse stylesheet order", () => {
    const family = parseFontFamilyFromCss("labels", GOOGLE_FONTS_CSS);
    expect(family.family).toBe("labels");
    expect(family.faces).toHaveLength(3);
    // CSS gives later @font-face rules precedence on range overlap, so
    // blocks come out reversed: Archivo's latin block ends up before its
    // latin-ext/vietnamese ones. Use the fontFamily array to order families.
    expect(family.faces[0].url).toContain("notosansjp");
    expect(family.faces[1]).toEqual({
      url: "https://fonts.gstatic.com/s/archivo/v25/latin.woff2",
      unicodeRanges: [
        { from: 0x0, to: 0xff },
        { from: 0x2000, to: 0x206f },
      ],
    });
    expect(family.faces[2].url).toContain("viet");
  });

  it("routes overlap-declared codepoints to the later (more specific) block", () => {
    // Mimics Google Fonts: latin-ext declares a broad range including
    // U+0131, but the glyph only exists in the latin file declared after it.
    const css = `
      @font-face { font-family: A; font-style: normal; font-weight: 800; src: url(latin-ext.woff2); unicode-range: U+0100-024F; }
      @font-face { font-family: A; font-style: normal; font-weight: 800; src: url(latin.woff2); unicode-range: U+0000-00FF, U+0131; }
    `;
    const family = parseFontFamilyFromCss("labels", css);
    expect(family.faces.map((f) => f.url)).toEqual([
      "latin.woff2",
      "latin-ext.woff2",
    ]);
  });

  it("filters blocks by font-family name", () => {
    const family = parseFontFamilyFromCss("labels", GOOGLE_FONTS_CSS, {
      fontFamily: "Noto Sans JP",
    });
    expect(family.faces).toHaveLength(1);
    expect(family.faces[0].url).toContain("notosansjp");
  });

  it("orders faces by fontFamily array position, not stylesheet order", () => {
    // Google Fonts sorts blocks alphabetically; the caller's array wins.
    const family = parseFontFamilyFromCss("labels", GOOGLE_FONTS_CSS, {
      fontFamily: ["Noto Sans JP", "Archivo"],
    });
    expect(family.faces.map((f) => f.url)).toEqual([
      "https://fonts.gstatic.com/s/notosansjp/v56/slice.58.woff2",
      "https://fonts.gstatic.com/s/archivo/v25/latin.woff2",
      "https://fonts.gstatic.com/s/archivo/v25/viet.woff2",
    ]);
  });

  it("filters blocks by weight and style", () => {
    const css = `
      @font-face { font-family: A; font-style: italic; font-weight: 400; src: url(a-italic.woff2); }
      @font-face { font-family: A; font-style: normal; font-weight: 700; src: url(a-bold.woff2); }
    `;
    const family = parseFontFamilyFromCss("labels", css, {
      fontStyle: "normal",
      fontWeight: 700,
    });
    expect(family.faces).toHaveLength(1);
    expect(family.faces[0].url).toBe("a-bold.woff2");
  });

  it("covers all codepoints when a block has no unicode-range", () => {
    const css = `@font-face { font-family: A; src: url(a.woff2); }`;
    const family = parseFontFamilyFromCss("labels", css);
    expect(family.faces[0].unicodeRanges).toEqual([{ from: 0, to: 0x10ffff }]);
  });

  it("resolves relative src URLs against baseUrl", () => {
    const css = `@font-face { font-family: A; src: url(./fonts/a.woff2); unicode-range: U+0-7F; }`;
    const family = parseFontFamilyFromCss("labels", css, {
      baseUrl: "https://example.com/styles/fonts.css",
    });
    expect(family.faces[0].url).toBe(
      "https://example.com/styles/fonts/a.woff2",
    );
  });

  it("prefers the woff2 source when src lists several formats", () => {
    const css = `@font-face {
      font-family: A;
      src: url("a.eot") format("embedded-opentype"), url('a.woff2') format('woff2'), url(a.ttf) format(truetype);
    }`;
    const family = parseFontFamilyFromCss("labels", css);
    expect(family.faces[0].url).toBe("a.woff2");
  });

  it("throws when no block matches", () => {
    expect(() =>
      parseFontFamilyFromCss("labels", GOOGLE_FONTS_CSS, {
        fontFamily: "Nope",
      }),
    ).toThrow(/no @font-face rules matched/);
  });
});

describe("fetchFontFamilyFromCss", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches stylesheets and concatenates faces in URL order", async () => {
    const cssByUrl: Record<string, string> = {
      "https://a.test/fonts.css": `@font-face { font-family: A; src: url(/a.woff2); unicode-range: U+0-7F; }`,
      "https://b.test/fonts.css": `@font-face { font-family: B; src: url(/b.woff2); unicode-range: U+4E00-9FFF; }`,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        url,
        text: async () => cssByUrl[url],
      })),
    );
    const family = await fetchFontFamilyFromCss("labels", [
      "https://a.test/fonts.css",
      "https://b.test/fonts.css",
    ]);
    expect(family.faces.map((f) => f.url)).toEqual([
      "https://a.test/a.woff2",
      "https://b.test/b.woff2",
    ]);
  });

  it("throws on a failed response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 403,
        url: "",
        text: async () => "",
      })),
    );
    await expect(
      fetchFontFamilyFromCss("labels", "https://a.test/fonts.css"),
    ).rejects.toThrow(/403/);
  });
});
