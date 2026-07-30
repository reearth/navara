import { LoadingManager, type WebGLRenderer } from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Atmosphere, type AtmosphereOptions } from "./atmosphere";
import { ATMOSPHERE_TEXTURE_URLS } from "./constants";

const { loadAsyncMock, loaderManagers } = vi.hoisted(() => ({
  loadAsyncMock: vi.fn(),
  loaderManagers: [] as unknown[],
}));

vi.mock("@takram/three-atmosphere", () => ({
  PrecomputedTexturesLoader: class {
    constructor(_options?: unknown, manager?: unknown) {
      loaderManagers.push(manager);
    }
    setType() {
      return this;
    }
    loadAsync = loadAsyncMock;
  },
  getSunDirectionECEF: vi.fn(),
  getMoonDirectionECEF: vi.fn(),
  getECIToECEFRotationMatrix: vi.fn(),
}));

const createAtmosphere = (options?: Partial<AtmosphereOptions>) =>
  new Atmosphere({} as unknown as WebGLRenderer, {
    date: new Date(0),
    ...options,
  });

const fakeTextures = () => ({}) as never;

describe("Atmosphere.initTextures", () => {
  beforeEach(() => {
    loadAsyncMock.mockReset();
    loaderManagers.length = 0;
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

  it("uses a URL-modifying LoadingManager for the bundled default assets", async () => {
    loadAsyncMock.mockResolvedValue(fakeTextures());
    const atmosphere = createAtmosphere();

    await atmosphere.initTextures();

    expect(loadAsyncMock).toHaveBeenCalledWith("");
    const manager = loaderManagers[0];
    expect(manager).toBeInstanceOf(LoadingManager);
  });

  it("remaps every filename PrecomputedTexturesLoader may request to its static URL", async () => {
    loadAsyncMock.mockResolvedValue(fakeTextures());
    const atmosphere = createAtmosphere();

    await atmosphere.initTextures();

    const manager = loaderManagers[0] as LoadingManager;
    const filenames = [
      "transmittance.exr",
      "scattering.exr",
      "irradiance.exr",
      "higher_order_scattering.exr",
      "single_mie_scattering.exr",
    ];
    for (const filename of filenames) {
      expect(manager.resolveURL(filename)).toBe(
        ATMOSPHERE_TEXTURE_URLS[filename],
      );
      // The loader may prefix a directory path; only the filename matters.
      expect(manager.resolveURL(`some/dir/${filename}`)).toBe(
        ATMOSPHERE_TEXTURE_URLS[filename],
      );
    }
    expect(manager.resolveURL("unrelated.png")).toBe("unrelated.png");
  });

  it("loads from atmosphereAssetsUrl directly when provided", async () => {
    loadAsyncMock.mockResolvedValue(fakeTextures());
    const atmosphere = createAtmosphere({
      atmosphereAssetsUrl: "https://example.com/assets",
    });

    await atmosphere.initTextures();

    expect(loadAsyncMock).toHaveBeenCalledWith("https://example.com/assets");
    expect(loaderManagers[0]).toBeUndefined();
  });
});
