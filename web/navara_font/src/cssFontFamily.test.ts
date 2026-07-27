import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";

import {
  fetchFontFamilyFromCss,
  parseCssUnicodeRange,
  parseFontFamilyFromCss,
} from "./cssFontFamily";

// The @font-face / unicode-range parsing itself lives in Rust (navara_wasm_api)
// and is covered by that crate's tests. Here the WASM module is mocked so these
// tests stay WASM-free and focus on the TypeScript orchestration: lazy init,
// delegation, and the fetch handling in `fetchFontFamilyFromCss`.
const { initApi, wasmParseCssUnicodeRange, wasmParseFontFamilyFromCss } =
  vi.hoisted(() => ({
    initApi: vi.fn(async () => undefined),
    wasmParseCssUnicodeRange: vi.fn(),
    wasmParseFontFamilyFromCss: vi.fn(),
  }));

vi.mock("@navaramap/engine-api", () => ({
  default: initApi,
  parseCssUnicodeRange: wasmParseCssUnicodeRange,
  parseFontFamilyFromCss: wasmParseFontFamilyFromCss,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("parseCssUnicodeRange", () => {
  it("initializes the WASM module and delegates", async () => {
    const ranges = [{ from: 0x26, to: 0x26 }];
    wasmParseCssUnicodeRange.mockReturnValue(ranges);
    // First wrapper call of the module: init runs here. Init is memoized
    // (see `ensureApi`), so later tests share it and don't re-invoke it —
    // hence the init assertion lives only in this first test.
    const result = await parseCssUnicodeRange("U+26");
    expect(initApi).toHaveBeenCalled();
    expect(wasmParseCssUnicodeRange).toHaveBeenCalledWith("U+26");
    expect(result).toBe(ranges);
  });
});

describe("parseFontFamilyFromCss", () => {
  it("delegates to the WASM parser with options", async () => {
    const family = { family: "labels", faces: [] };
    wasmParseFontFamilyFromCss.mockReturnValue(family);
    const options = { fontFamily: "Archivo", baseUrl: "https://a.test/" };
    const result = await parseFontFamilyFromCss("labels", "css", options);
    expect(wasmParseFontFamilyFromCss).toHaveBeenCalledWith(
      "labels",
      "css",
      options,
    );
    expect(result).toBe(family);
  });
});

describe("fetchFontFamilyFromCss", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches stylesheets and concatenates faces in URL order", async () => {
    const cssByUrl: Record<string, string> = {
      "https://a.test/fonts.css": "@font-face-a",
      "https://b.test/fonts.css": "@font-face-b",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        url,
        text: async () => cssByUrl[url],
      })),
    );
    // Echo the resolved baseUrl back as the face URL so we can assert both the
    // per-stylesheet baseUrl threading and the URL-order concatenation.
    wasmParseFontFamilyFromCss.mockImplementation(
      (family: string, _cssText: string, options: { baseUrl?: string }) => ({
        family,
        faces: [{ url: options.baseUrl, unicodeRanges: [] }],
      }),
    );

    const family = await fetchFontFamilyFromCss("labels", [
      "https://a.test/fonts.css",
      "https://b.test/fonts.css",
    ]);

    expect(family.family).toBe("labels");
    expect(family.faces.map((f) => f.url)).toEqual([
      "https://a.test/fonts.css",
      "https://b.test/fonts.css",
    ]);
  });

  it("passes requestInit to fetch and filter options (minus requestInit) to the parser", async () => {
    const requestInit = { credentials: "include" as const };
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      url,
      text: async () => "css",
    }));
    vi.stubGlobal("fetch", fetchMock);
    wasmParseFontFamilyFromCss.mockReturnValue({ family: "labels", faces: [] });

    await fetchFontFamilyFromCss("labels", "https://a.test/fonts.css", {
      requestInit,
      fontFamily: "Archivo",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://a.test/fonts.css",
      requestInit,
    );
    // requestInit must not leak into the parser options.
    expect(wasmParseFontFamilyFromCss).toHaveBeenCalledWith("labels", "css", {
      fontFamily: "Archivo",
      baseUrl: "https://a.test/fonts.css",
    });
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
