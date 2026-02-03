import { MeshStandardMaterial } from "three";
import { beforeEach, describe, expect, it } from "vitest";

import { createModelBaseEnhancer } from ".";

describe("modelBaseEnhancer", () => {
  let enhancer: ReturnType<typeof createModelBaseEnhancer>;

  beforeEach(() => {
    enhancer = createModelBaseEnhancer(new MeshStandardMaterial());
  });

  describe("lifecycle", () => {
    it("states() should throw if called before mount", () => {
      const freshEnhancer = createModelBaseEnhancer(new MeshStandardMaterial());
      expect(() => freshEnhancer.states()).toThrow(
        "mount() must be called before states",
      );
    });

    it("mutates() should throw if called before mount", () => {
      const freshEnhancer = createModelBaseEnhancer(new MeshStandardMaterial());
      expect(() => freshEnhancer.mutates()).toThrow(
        "mount() must be called before mutates",
      );
    });

    it("update() should throw if called before mount", () => {
      const freshEnhancer = createModelBaseEnhancer(new MeshStandardMaterial());
      expect(() => freshEnhancer.update({})).toThrow(
        "mount() must be called before update",
      );
    });
  });

  describe("programCacheKey", () => {
    it("should return cache key based on shader-affecting state", () => {
      enhancer.mount({
        useBatchTexture: true,
        useBatchColorShow: false,
      });

      const cacheKey = enhancer.programCacheKey();
      const parsed = JSON.parse(cacheKey);

      expect(parsed).toEqual({
        useBatchTexture: true,
        useBatchColorShow: false,
      });
    });

    it("should return different cache keys for different shader-affecting states", () => {
      enhancer.mount({ useBatchTexture: false });
      const cacheKey1 = enhancer.programCacheKey();

      const enhancer2 = createModelBaseEnhancer(new MeshStandardMaterial());
      enhancer2.mount({ useBatchTexture: true });
      const cacheKey2 = enhancer2.programCacheKey();

      expect(cacheKey1).not.toBe(cacheKey2);
    });

    it("should return same cache key for same shader-affecting states with different non-affecting states", () => {
      enhancer.mount({ useBatchTexture: true, pickable: true });
      const cacheKey1 = enhancer.programCacheKey();

      const enhancer2 = createModelBaseEnhancer(new MeshStandardMaterial());
      enhancer2.mount({ useBatchTexture: true, pickable: false });
      const cacheKey2 = enhancer2.programCacheKey();

      expect(cacheKey1).toBe(cacheKey2);
    });
  });
});
