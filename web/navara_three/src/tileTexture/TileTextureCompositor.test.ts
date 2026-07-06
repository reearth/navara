import { Mesh, BoxGeometry, MeshBasicMaterial } from "three";
import { describe, expect, it, vi } from "vitest";

import { TexturizedSceneByTileCoordinates } from "../scene";

import { TileTextureCompositor } from "./TileTextureCompositor";
import type { AtlasFactory, CompositeAtlas } from "./types";

// Minimal renderer mock — only the methods the compositor touches need to
// exist. We track `render` so tests can assert which scenes were drawn.
function makeRenderer() {
  return {
    autoClear: true,
    getRenderTarget: vi.fn().mockReturnValue(null),
    setRenderTarget: vi.fn(),
    getClearColor: vi.fn().mockImplementation((c) => c),
    getClearAlpha: vi.fn().mockReturnValue(1),
    setClearColor: vi.fn(),
    clear: vi.fn(),
    render: vi.fn(),
  };
}

function makeFakeAtlas(): CompositeAtlas {
  const tex = (n: string) =>
    ({ name: n, needsUpdate: false }) as unknown as CompositeAtlas["color"];
  return {
    target: { dispose: vi.fn() } as unknown as CompositeAtlas["target"],
    color: tex("color"),
    attr: tex("attr"),
    normal: tex("normal"),
    dispose: vi.fn(),
  };
}

const fakeFactory: AtlasFactory = () => makeFakeAtlas();

function setup() {
  const renderer = makeRenderer();
  const texturizedScenes = new TexturizedSceneByTileCoordinates(
    renderer as unknown as ConstructorParameters<
      typeof TexturizedSceneByTileCoordinates
    >[0],
  );
  const compositor = new TileTextureCompositor({
    renderer: renderer as unknown as ConstructorParameters<
      typeof TileTextureCompositor
    >[0]["renderer"],
    texturizedSceneByTileCoordinates: texturizedScenes,
    atlasFactory: fakeFactory,
  });
  return { compositor, renderer, texturizedScenes };
}

function mesh() {
  return new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
}

describe("TileTextureCompositor.acquire/release", () => {
  it("acquire returns CompositeOutputs and dedupes by handle", () => {
    const { compositor } = setup();
    const out = compositor.acquire(1n);
    expect(out.color).toBeDefined();
    expect(out.attr).toBeDefined();
    expect(out.normal).toBeDefined();
    // Re-acquire returns same outputs (cache dedupes).
    const again = compositor.acquire(1n);
    expect(again.color).toBe(out.color);
  });

  it("release disposes once refCount drops to zero", () => {
    const { compositor } = setup();
    compositor.acquire(1n);
    compositor.acquire(1n);
    const entry = compositor.cache.getEntry(1n);
    if (!entry) throw new Error("expected entry");
    const atlas = entry.atlas;

    compositor.release(1n);
    expect(atlas.dispose).not.toHaveBeenCalled();
    compositor.release(1n);
    expect(atlas.dispose).toHaveBeenCalledTimes(1);
  });
});

describe("TileTextureCompositor.renderVectorScenes", () => {
  const fakeRT = (): unknown => ({ texture: { needsUpdate: false } });

  it("bakes each layer's resolved source into its render target", () => {
    const { compositor, renderer, texturizedScenes } = setup();
    texturizedScenes.add(1n, "layer-a", mesh(), 0);
    texturizedScenes.add(2n, "layer-b", mesh(), 1);

    const rt0 = fakeRT();
    const rt1 = fakeRT();
    compositor.renderVectorScenes(
      [
        {
          layerId: "layer-a",
          sources: [{ tileHandle: 1n, uvOffset: [0, 0], uvScale: [1, 1] }],
        },
        {
          layerId: "layer-b",
          sources: [{ tileHandle: 2n, uvOffset: [0, 0], uvScale: [1, 1] }],
        },
      ],
      [rt0 as never, rt1 as never],
    );

    // One render per populated slot; every target cleared and flagged.
    expect(renderer.render).toHaveBeenCalledTimes(2);
    expect(renderer.clear).toHaveBeenCalledTimes(2);
    expect(
      (rt0 as { texture: { needsUpdate: boolean } }).texture.needsUpdate,
    ).toBe(true);
    expect(
      (rt1 as { texture: { needsUpdate: boolean } }).texture.needsUpdate,
    ).toBe(true);
  });

  it("accumulates a layer's N:M sources into one render target, clearing once", () => {
    const { compositor, renderer, texturizedScenes } = setup();
    // Two WM source tiles overlapping one Geographic terrain tile, both backing
    // the same layer (west half and east half).
    texturizedScenes.add(1n, "layer-a", mesh(), 0);
    texturizedScenes.add(2n, "layer-a", mesh(), 0);

    compositor.renderVectorScenes(
      [
        {
          layerId: "layer-a",
          sources: [
            { tileHandle: 1n, uvOffset: [0, 0], uvScale: [0.5, 1] },
            { tileHandle: 2n, uvOffset: [0.5, 0], uvScale: [0.5, 1] },
          ],
        },
      ],
      [fakeRT() as never],
    );

    // Both sources drawn into the single RT, which was cleared exactly once so
    // the second source mosaics with the first instead of wiping it. autoClear
    // is disabled across the draws and restored afterwards.
    expect(renderer.render).toHaveBeenCalledTimes(2);
    expect(renderer.clear).toHaveBeenCalledTimes(1);
    expect(renderer.autoClear).toBe(true);
  });

  it("frames the terrain sub-rect when the source resolves to a coarser ancestor", () => {
    const { compositor, renderer, texturizedScenes } = setup();
    texturizedScenes.add(1n, "layer-a", mesh(), 0);

    // NW quadrant of the ancestor: uvOffset=(0,0.5), uvScale=(0.5,0.5).
    compositor.renderVectorScenes(
      [
        {
          layerId: "layer-a",
          sources: [
            { tileHandle: 1n, uvOffset: [0, 0.5], uvScale: [0.5, 0.5] },
          ],
        },
      ],
      [fakeRT() as never],
    );

    expect(renderer.render).toHaveBeenCalledTimes(1);
    const cam = renderer.render.mock.calls[0][1] as {
      left: number;
      right: number;
      bottom: number;
      top: number;
    };
    // Matches ortho_camera_transform for the NW sub-tile: [-1,0]×[0,1].
    expect(cam.left).toBe(-1);
    expect(cam.right).toBe(0);
    expect(cam.bottom).toBe(0);
    expect(cam.top).toBe(1);
  });

  it("clears but does not render a source whose scene was removed", () => {
    const { compositor, renderer, texturizedScenes } = setup();
    const m = mesh();
    texturizedScenes.add(1n, "layer-a", m, 0);
    texturizedScenes.removeMesh(1n, "layer-a", m);

    const rt = fakeRT();
    compositor.renderVectorScenes(
      [
        {
          layerId: "layer-a",
          sources: [{ tileHandle: 1n, uvOffset: [0, 0], uvScale: [1, 1] }],
        },
      ],
      [rt as never],
    );

    expect(renderer.render).not.toHaveBeenCalled();
    expect(renderer.clear).toHaveBeenCalledTimes(1);
  });

  it("clears a render target that has no slot", () => {
    const { compositor, renderer } = setup();

    const rt = fakeRT();
    compositor.renderVectorScenes([], [rt as never]);

    expect(renderer.render).not.toHaveBeenCalled();
    expect(renderer.clear).toHaveBeenCalledTimes(1);
  });

  it("clears (does not render) a source whose scene hasn't reached the cache yet", () => {
    const { compositor, renderer } = setup();

    // The sub-rect stays transparent during the transition window; a coarser
    // ancestor backs the gap via the Rust scene-ready walk-up.
    const rt = fakeRT();
    compositor.renderVectorScenes(
      [
        {
          layerId: "pending",
          sources: [{ tileHandle: 99n, uvOffset: [0, 0], uvScale: [1, 1] }],
        },
      ],
      [rt as never],
    );

    expect(renderer.render).not.toHaveBeenCalled();
    expect(renderer.clear).toHaveBeenCalledTimes(1);
  });
});
