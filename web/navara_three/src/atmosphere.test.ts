import type { WebGLRenderer } from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Atmosphere } from "./atmosphere";

const { loadAsyncMock } = vi.hoisted(() => ({
  loadAsyncMock: vi.fn(),
}));

vi.mock("@takram/three-atmosphere", () => ({
  PrecomputedTexturesLoader: class {
    setType() {
      return this;
    }
    loadAsync = loadAsyncMock;
  },
  getSunDirectionECEF: vi.fn(),
  getMoonDirectionECEF: vi.fn(),
  getECIToECEFRotationMatrix: vi.fn(),
}));

const createAtmosphere = () =>
  new Atmosphere({} as unknown as WebGLRenderer, { date: new Date(0) });

const fakeTextures = () => ({}) as never;

describe("Atmosphere.initTextures", () => {
  beforeEach(() => {
    loadAsyncMock.mockReset();
  });

  it("shares a single load across concurrent calls", async () => {
    loadAsyncMock.mockResolvedValue(fakeTextures());
    const atmosphere = createAtmosphere();

    await Promise.all([atmosphere.initTextures(), atmosphere.initTextures()]);

    expect(loadAsyncMock).toHaveBeenCalledTimes(1);
    expect(atmosphere.textures).toBeDefined();
  });

  it("returns immediately once textures are loaded", async () => {
    loadAsyncMock.mockResolvedValue(fakeTextures());
    const atmosphere = createAtmosphere();

    await atmosphere.initTextures();
    await atmosphere.initTextures();

    expect(loadAsyncMock).toHaveBeenCalledTimes(1);
  });

  it("emits textureLoaded exactly once", async () => {
    loadAsyncMock.mockResolvedValue(fakeTextures());
    const atmosphere = createAtmosphere();
    const onLoaded = vi.fn();
    atmosphere.on("textureLoaded", onLoaded);

    await Promise.all([atmosphere.initTextures(), atmosphere.initTextures()]);

    expect(onLoaded).toHaveBeenCalledTimes(1);
  });

  it("allows retrying after a failed load", async () => {
    loadAsyncMock.mockRejectedValueOnce(new Error("network error"));
    loadAsyncMock.mockResolvedValueOnce(fakeTextures());
    const atmosphere = createAtmosphere();

    await expect(atmosphere.initTextures()).rejects.toThrow("network error");
    expect(atmosphere.textures).toBeUndefined();

    await atmosphere.initTextures();

    expect(loadAsyncMock).toHaveBeenCalledTimes(2);
    expect(atmosphere.textures).toBeDefined();
  });
});
