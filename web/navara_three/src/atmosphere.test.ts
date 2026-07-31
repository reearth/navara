import { type WebGLRenderer } from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Atmosphere, type AtmosphereOptions } from "./atmosphere";

const { loadAsyncMock } = vi.hoisted(() => ({
  loadAsyncMock: vi.fn(),
}));

vi.mock("@takram/three-atmosphere", () => ({
  getSunDirectionECEF: vi.fn(),
  getMoonDirectionECEF: vi.fn(),
  getECIToECEFRotationMatrix: vi.fn(),
  TRANSMITTANCE_TEXTURE_WIDTH: 256,
  TRANSMITTANCE_TEXTURE_HEIGHT: 64,
  IRRADIANCE_TEXTURE_WIDTH: 64,
  IRRADIANCE_TEXTURE_HEIGHT: 16,
  SCATTERING_TEXTURE_WIDTH: 256,
  SCATTERING_TEXTURE_HEIGHT: 128,
  SCATTERING_TEXTURE_DEPTH: 32,
}));

vi.mock("@takram/three-geospatial", () => {
  class MockLoader {
    loadAsync = loadAsyncMock;
  }
  return {
    EXRTextureLoader: MockLoader,
    EXR3DTextureLoader: MockLoader,
    isFloatLinearSupported: () => false,
    reinterpretType: () => {},
  };
});

const fakeTexture = () => ({ image: {}, dispose: vi.fn() });

/** Resolves every load immediately with a fake texture, recording the URL. */
const autoResolveLoads = () => {
  loadAsyncMock.mockImplementation(() => Promise.resolve(fakeTexture()));
};

const requestedFiles = () =>
  loadAsyncMock.mock.calls.map((call) => {
    const url = call[0] as string;
    return url.slice(url.lastIndexOf("/") + 1).replace(/\?.*$/, "");
  });

const createAtmosphere = (options?: Partial<AtmosphereOptions>) =>
  new Atmosphere({} as unknown as WebGLRenderer, {
    date: new Date(0),
    ...options,
  });

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("Atmosphere.initTextures", () => {
  beforeEach(() => {
    loadAsyncMock.mockReset();
  });

  it("loads all four textures", async () => {
    autoResolveLoads();
    const atmosphere = createAtmosphere();

    await atmosphere.initTextures();

    expect(requestedFiles().sort()).toEqual([
      "higher_order_scattering.exr",
      "irradiance.exr",
      "scattering.exr",
      "transmittance.exr",
    ]);
    expect(atmosphere.textures.transmittanceTexture).toBeDefined();
    expect(atmosphere.textures.scatteringTexture).toBeDefined();
    expect(atmosphere.textures.irradianceTexture).toBeDefined();
    expect(atmosphere.textures.higherOrderScatteringTexture).toBeDefined();
  });

  it("shares in-flight loads across concurrent calls", async () => {
    autoResolveLoads();
    const atmosphere = createAtmosphere();

    await Promise.all([atmosphere.initTextures(), atmosphere.initTextures()]);

    expect(loadAsyncMock).toHaveBeenCalledTimes(4);
  });

  it("does not reload once textures are loaded", async () => {
    autoResolveLoads();
    const atmosphere = createAtmosphere();

    await atmosphere.initTextures();
    await atmosphere.initTextures();

    expect(loadAsyncMock).toHaveBeenCalledTimes(4);
  });

  it("emits textureLoaded once per texture", async () => {
    autoResolveLoads();
    const atmosphere = createAtmosphere();
    const onLoaded = vi.fn();
    atmosphere.on("textureLoaded", onLoaded);

    await atmosphere.initTextures();

    expect(onLoaded).toHaveBeenCalledTimes(4);
  });

  it("retries only the texture that failed", async () => {
    let failTransmittance = true;
    loadAsyncMock.mockImplementation((url: string) => {
      if (failTransmittance && url.includes("transmittance.exr")) {
        return Promise.reject(new Error("network error"));
      }
      return Promise.resolve(fakeTexture());
    });
    const atmosphere = createAtmosphere();

    await expect(atmosphere.initTextures()).rejects.toThrow("network error");
    expect(atmosphere.textures.transmittanceTexture).toBeUndefined();
    expect(atmosphere.textures.scatteringTexture).toBeDefined();

    failTransmittance = false;
    await atmosphere.initTextures();

    expect(atmosphere.textures.transmittanceTexture).toBeDefined();
    expect(
      requestedFiles().filter((f) => f === "transmittance.exr"),
    ).toHaveLength(2);
    expect(requestedFiles().filter((f) => f === "scattering.exr")).toHaveLength(
      1,
    );
  });

  it("loads from atmosphereAssetsUrl when provided, normalizing slashes", async () => {
    autoResolveLoads();
    const atmosphere = createAtmosphere({
      atmosphereAssetsUrl: "https://example.com/assets/",
    });

    await atmosphere.initTextures();

    for (const [url] of loadAsyncMock.mock.calls as [string][]) {
      expect(url).toMatch(/^https:\/\/example\.com\/assets\/[a-z_]+\.exr$/);
    }
  });
});

describe("Atmosphere.onTexturesReady", () => {
  beforeEach(() => {
    loadAsyncMock.mockReset();
  });

  it("does not load anything until a consumer registers", () => {
    autoResolveLoads();
    createAtmosphere();

    expect(loadAsyncMock).not.toHaveBeenCalled();
  });

  it("loads only the needed textures", async () => {
    autoResolveLoads();
    const atmosphere = createAtmosphere();
    const callback = vi.fn();

    atmosphere.onTexturesReady(callback, { transmittance: true });
    await flush();

    expect(requestedFiles()).toEqual(["transmittance.exr"]);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0].transmittanceTexture).toBeDefined();
  });

  it("shares a fetch between consumers needing the same texture", async () => {
    autoResolveLoads();
    const atmosphere = createAtmosphere();
    const first = vi.fn();
    const second = vi.fn();

    atmosphere.onTexturesReady(first, { transmittance: true });
    atmosphere.onTexturesReady(second, { transmittance: true });
    await flush();

    expect(loadAsyncMock).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("fetches only the missing textures for wider needs", async () => {
    autoResolveLoads();
    const atmosphere = createAtmosphere();

    atmosphere.onTexturesReady(vi.fn(), { transmittance: true });
    await flush();
    const callback = vi.fn();
    atmosphere.onTexturesReady(callback, {
      transmittance: true,
      scattering: true,
    });
    await flush();

    expect(requestedFiles()).toEqual(["transmittance.exr", "scattering.exr"]);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("loads all textures and fires once when needs are omitted", async () => {
    autoResolveLoads();
    const atmosphere = createAtmosphere();
    const callback = vi.fn();

    atmosphere.onTexturesReady(callback);
    await flush();

    expect(loadAsyncMock).toHaveBeenCalledTimes(4);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("waits until every needed texture is ready", async () => {
    const pending = new Map<string, (t: unknown) => void>();
    loadAsyncMock.mockImplementation(
      (url: string) =>
        new Promise((resolve) => {
          pending.set(
            url.slice(url.lastIndexOf("/") + 1).replace(/\?.*$/, ""),
            resolve,
          );
        }),
    );
    const atmosphere = createAtmosphere();
    const callback = vi.fn();

    atmosphere.onTexturesReady(callback, {
      transmittance: true,
      scattering: true,
    });
    pending.get("transmittance.exr")?.(fakeTexture());
    await flush();
    expect(callback).not.toHaveBeenCalled();

    pending.get("scattering.exr")?.(fakeTexture());
    await flush();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("invokes the callback immediately once loaded", async () => {
    autoResolveLoads();
    const atmosphere = createAtmosphere();
    await atmosphere.initTextures();
    const callback = vi.fn();

    atmosphere.onTexturesReady(callback, { irradiance: true });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(loadAsyncMock).toHaveBeenCalledTimes(4);
  });

  it("logs instead of rejecting when a lazy load fails", async () => {
    const error = new Error("network error");
    loadAsyncMock.mockRejectedValue(error);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const atmosphere = createAtmosphere();

    atmosphere.onTexturesReady(vi.fn(), { transmittance: true });

    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to load atmosphere textures:",
        error,
      );
    });
    consoleError.mockRestore();
  });
});
