import { Mesh, BoxGeometry, MeshBasicMaterial } from "three";
import { describe, expect, it, vi } from "vitest";

import { TexturizedSceneByTileCoordinates } from "../scene";

import { TileTextureCompositor } from "./TileTextureCompositor";
import type { AtlasFactory, CompositeAtlas } from "./types";

// Minimal renderer mock — only the methods the compositor touches need to
// exist. We track `render` so tests can assert which scenes were drawn.
function makeRenderer() {
  return {
    getRenderTarget: vi.fn().mockReturnValue(null),
    setRenderTarget: vi.fn(),
    getClearColor: vi.fn().mockImplementation((c) => c),
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
  it("acquire returns CompositeOutputs and creates one camera per handle", () => {
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
  it("skips render when texturizedScenes.needsUpdate is false", () => {
    const { compositor, renderer, texturizedScenes } = setup();
    texturizedScenes.add(1n, "layer-a", mesh(), 0);
    texturizedScenes.setNeedsUpdate(1n, false);

    const rendered = compositor.renderVectorScenes(
      1n,
      [{} as never],
      () => undefined,
      () => undefined,
    );

    expect(rendered).toBe(false);
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it("renders every populated layer once when dirty", () => {
    const { compositor, renderer, texturizedScenes } = setup();
    texturizedScenes.add(1n, "layer-a", mesh(), 0);
    texturizedScenes.add(1n, "layer-b", mesh(), 1);
    texturizedScenes.setNeedsUpdate(1n, true);

    const fakeRT = (): unknown => ({
      texture: { needsUpdate: false },
    });
    const visibility = vi.fn();
    const rendered = compositor.renderVectorScenes(
      1n,
      [fakeRT() as never, fakeRT() as never],
      () => ({ candidateParent: undefined, isRendered: true }),
      visibility,
    );

    expect(rendered).toBe(true);
    expect(renderer.render).toHaveBeenCalledTimes(2);
    expect(visibility).toHaveBeenCalledWith("layer-a", true);
    expect(visibility).toHaveBeenCalledWith("layer-b", true);
    expect(texturizedScenes.getNeedsUpdate(1n)).toBe(false);
  });

  it("hides (but does not render) removed scenes", () => {
    const { compositor, renderer, texturizedScenes } = setup();
    texturizedScenes.add(1n, "layer-a", mesh(), 0);
    texturizedScenes.remove(1n, "layer-a");
    texturizedScenes.setNeedsUpdate(1n, true);

    const visibility = vi.fn();
    compositor.renderVectorScenes(
      1n,
      [{ texture: { needsUpdate: false } } as never],
      () => undefined,
      visibility,
    );

    expect(renderer.render).not.toHaveBeenCalled();
    expect(visibility).toHaveBeenCalledWith("layer-a", false);
  });
});
