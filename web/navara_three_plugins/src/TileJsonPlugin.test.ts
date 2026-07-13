import { describe, it, expect, vi, afterEach } from "vitest";

import { TileJsonPlugin, type TileJson } from "./TileJsonPlugin";

// Importing the real @navara/three touches WASM/os at module load, which fails
// in the test environment. TileJsonPlugin only needs `Plugin` as a runtime base
// class (everything else it imports from there is type-only), so stub the module.
/* eslint-disable @typescript-eslint/no-extraneous-class */
vi.mock("@navara/three", () => ({
  default: class ThreeView {},
  Plugin: class Plugin {},
}));
/* eslint-enable @typescript-eslint/no-extraneous-class */

// A minimal fake of the pieces of ThreeView / Source that TileJsonPlugin touches.
function makeFakeView() {
  let counter = 0;
  const view = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addSource: vi.fn((desc: any) => ({
      id: desc.id ?? `src-${counter++}`,
      type: desc.type,
    })),
  };
  return { view };
}

// A spyable fake AttributionPlugin; the caller owns its lifecycle.
function makeFakeAttribution() {
  return { show: vi.fn() };
}

function initPlugin(
  view: unknown,
  attribution: unknown = makeFakeAttribution(),
) {
  const plugin = new TileJsonPlugin(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { attribution } as any,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugin.init(view as any, {} as any);
  return plugin;
}

// Stub fetch so addSource() resolves the given TileJSON document from its URL.
function stubTileJson(doc: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok,
      status: ok ? 200 : 404,
      statusText: ok ? "OK" : "Not Found",
      json: async () => doc,
    })),
  );
}

const RASTER_DOC: TileJson = {
  tilejson: "3.0.0",
  tiles: ["https://a.example/{z}/{x}/{y}.png"],
  attribution: "© Example",
  minzoom: 3,
  maxzoom: 18,
};

const DOC_URL = "https://example/tiles.json";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("TileJsonPlugin.addSource", () => {
  it("fetches the document and creates a raster-tile source with zoom + id mapped", async () => {
    const { view } = makeFakeView();
    const plugin = initPlugin(view);
    stubTileJson({
      tilejson: "3.0.0",
      tiles: ["https://a.example/{z}/{x}/{y}.png"],
      minzoom: 5,
      maxzoom: 16,
    } satisfies TileJson);

    const source = await plugin.addSource({
      type: "raster-tile",
      id: "basemap",
      url: DOC_URL,
    });

    expect(fetch).toHaveBeenCalledWith(DOC_URL);
    expect(view.addSource).toHaveBeenCalledTimes(1);
    expect(view.addSource).toHaveBeenCalledWith({
      type: "raster-tile",
      url: "https://a.example/{z}/{x}/{y}.png",
      id: "basemap",
      minZoom: 5,
      maxZoom: 16,
    });
    // A single Source handle is returned, carrying the caller-provided id.
    expect(source).toMatchObject({ id: "basemap", type: "raster-tile" });
  });

  it("uses only the first tile endpoint when the document lists mirrors", async () => {
    const { view } = makeFakeView();
    const plugin = initPlugin(view);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    stubTileJson({
      tilejson: "3.0.0",
      tiles: [
        "https://a.example/{z}/{x}/{y}.png",
        "https://b.example/{z}/{x}/{y}.png",
      ],
    } satisfies TileJson);

    await plugin.addSource({ type: "raster-tile", url: DOC_URL });

    expect(view.addSource).toHaveBeenCalledTimes(1);
    expect(view.addSource).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://a.example/{z}/{x}/{y}.png" }),
    );
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/mirror/));
    warn.mockRestore();
  });

  it("sets tms on raster sources when scheme is tms", async () => {
    const { view } = makeFakeView();
    const plugin = initPlugin(view);
    stubTileJson({
      tilejson: "3.0.0",
      tiles: ["https://a/{z}/{x}/{y}.png"],
      scheme: "tms",
    } satisfies TileJson);

    await plugin.addSource({ type: "raster-tile", url: DOC_URL });

    expect(view.addSource).toHaveBeenCalledWith(
      expect.objectContaining({ tms: true }),
    );
  });

  it("omits minZoom/tms for vector-tile sources (engine has no such fields)", async () => {
    const { view } = makeFakeView();
    const plugin = initPlugin(view);
    stubTileJson({
      tilejson: "3.0.0",
      tiles: ["https://a/{z}/{x}/{y}.pbf"],
      minzoom: 4,
      maxzoom: 14,
      scheme: "tms",
    } satisfies TileJson);

    await plugin.addSource({ type: "vector-tile", id: "v", url: DOC_URL });

    const desc = view.addSource.mock.calls[0][0];
    expect(desc).toEqual({
      type: "vector-tile",
      url: "https://a/{z}/{x}/{y}.pbf",
      id: "v",
      maxZoom: 14,
    });
    expect(desc).not.toHaveProperty("minZoom");
    expect(desc).not.toHaveProperty("tms");
  });

  it("throws when the TileJSON fetch fails", async () => {
    const { view } = makeFakeView();
    const plugin = initPlugin(view);
    stubTileJson({}, false);

    await expect(
      plugin.addSource({
        type: "raster-tile",
        url: "https://example/missing.json",
      }),
    ).rejects.toThrow(/failed to fetch TileJSON/);
  });

  it("rejects an invalid tilejson version field", async () => {
    const { view } = makeFakeView();
    const plugin = initPlugin(view);
    stubTileJson({ tilejson: "nope", tiles: ["https://a/{z}/{x}/{y}.png"] });

    await expect(
      plugin.addSource({ type: "raster-tile", url: DOC_URL }),
    ).rejects.toThrow(/tilejson.*version/i);
  });

  it("rejects a missing/empty tiles array", async () => {
    const { view } = makeFakeView();
    const plugin = initPlugin(view);
    stubTileJson({ tilejson: "3.0.0", tiles: [] });

    await expect(
      plugin.addSource({ type: "raster-tile", url: DOC_URL }),
    ).rejects.toThrow(/tiles.*non-empty/);
  });

  it("throws when called before init()", async () => {
    const plugin = new TileJsonPlugin({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      attribution: makeFakeAttribution() as any,
    });
    await expect(
      plugin.addSource({ type: "raster-tile", url: DOC_URL }),
    ).rejects.toThrow(/after view\.init/);
  });
});

describe("TileJsonPlugin attribution wiring", () => {
  it("shows the document's attribution through the supplied AttributionPlugin", async () => {
    const { view } = makeFakeView();
    const attribution = makeFakeAttribution();
    const plugin = initPlugin(view, attribution);
    stubTileJson(RASTER_DOC);

    await plugin.addSource({ type: "raster-tile", url: DOC_URL });
    expect(attribution.show).toHaveBeenLastCalledWith([
      { attributionHtml: "© Example" },
    ]);
  });

  it("does not dispose the supplied AttributionPlugin (caller owns it)", async () => {
    const { view } = makeFakeView();
    const attribution = { show: vi.fn(), dispose: vi.fn() };
    const plugin = initPlugin(view, attribution);

    plugin.dispose();
    expect(attribution.dispose).not.toHaveBeenCalled();
  });

  it("merges and de-duplicates credits across multiple addSource() calls", async () => {
    const { view } = makeFakeView();
    const attribution = makeFakeAttribution();
    const plugin = initPlugin(view, attribution);

    stubTileJson(RASTER_DOC);
    await plugin.addSource({ type: "raster-tile", url: DOC_URL });

    stubTileJson({
      tilejson: "3.0.0",
      tiles: ["https://c/{z}/{x}/{y}.png"],
      attribution: "© Other",
    } satisfies TileJson);
    await plugin.addSource({ type: "raster-tile", url: DOC_URL });

    // Same credit again — should not duplicate.
    stubTileJson({
      tilejson: "3.0.0",
      tiles: ["https://d/{z}/{x}/{y}.png"],
      attribution: "© Example",
    } satisfies TileJson);
    await plugin.addSource({ type: "raster-tile", url: DOC_URL });

    expect(attribution.show).toHaveBeenLastCalledWith([
      { attributionHtml: "© Example" },
      { attributionHtml: "© Other" },
    ]);
  });
});
