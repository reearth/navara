import { describe, it, expect, vi, afterEach } from "vitest";

import { CesiumIonPlugin } from "./CesiumIonPlugin";

// Importing the real @navara/three touches WASM/os at module load, which fails
// in the test environment. CesiumIonPlugin only needs `Plugin` as a runtime base
// class (everything else it imports is type-only), so stub the module.
/* eslint-disable @typescript-eslint/no-extraneous-class */
vi.mock("@navara/three", () => ({
  default: class ThreeView {},
  Plugin: class Plugin {},
}));
/* eslint-enable @typescript-eslint/no-extraneous-class */

// A minimal fake of the pieces of ThreeView / Source / Layer that
// CesiumIonPlugin.addTerrain touches. It records the descriptions passed to
// addSource/addLayer and lets a test fire the layer's "deleted" event.
function makeFakeView() {
  const source = { id: "src", type: "quantized-mesh", delete: vi.fn(() => true) };
  let onDeleted: (() => void) | undefined;
  const layer = {
    id: "layer",
    once: vi.fn((event: string, cb: () => void) => {
      if (event === "deleted") onDeleted = cb;
    }),
    // Deleting the layer emits "deleted", mirroring the real Layer.
    delete: vi.fn(() => onDeleted?.()),
  };
  const view = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addSource: vi.fn((_desc: any) => source),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addLayer: vi.fn((_desc: any) => layer),
  };
  return { view, source, layer };
}

async function initPlugin(view: unknown) {
  const plugin = new CesiumIonPlugin({ assetId: 42, accessToken: "user-tok" });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        url: "https://tiles.example/",
        accessToken: "asset-tok",
      }),
    })),
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await plugin.init(view as any, {} as any);
  return plugin;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CesiumIonPlugin.addTerrain", () => {
  it("routes fetch options to the source and render options to the layer", async () => {
    const { view, source } = makeFakeView();
    const plugin = await initPlugin(view);

    plugin.addTerrain({
      maxZoom: 14,
      requestVertexNormals: true,
      castShadow: true,
    });

    // Source carries the resolved endpoint URL/token and the fetch options,
    // but not the render options.
    expect(view.addSource).toHaveBeenCalledWith({
      type: "quantized-mesh",
      url: "https://tiles.example/{z}/{x}/{y}.terrain",
      token: "asset-tok",
      maxZoom: 14,
      requestVertexNormals: true,
    });
    const sourceDesc = view.addSource.mock.calls[0][0];
    expect(sourceDesc).not.toHaveProperty("castShadow");

    // Layer references the source and receives the render options.
    expect(view.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "terrain",
        source,
        terrain: expect.objectContaining({ castShadow: true }),
      }),
    );
    const layerDesc = view.addLayer.mock.calls[0][0];
    expect(layerDesc.terrain).not.toHaveProperty("maxZoom");
  });

  it("reclaims the implicit source when the layer is deleted", async () => {
    const { view, source, layer } = makeFakeView();
    const plugin = await initPlugin(view);

    plugin.addTerrain();

    expect(source.delete).not.toHaveBeenCalled();
    layer.delete();
    expect(source.delete).toHaveBeenCalledTimes(1);
  });

  it("throws when called before init()", () => {
    const plugin = new CesiumIonPlugin({ assetId: 1, accessToken: "t" });
    expect(() => plugin.addTerrain()).toThrow(/after view\.init/);
  });
});
