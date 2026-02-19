import { MeshLambertMaterial } from "three";
import { beforeEach, describe, expect, it } from "vitest";

import { createPolygonBaseEnhancer } from ".";

describe("polygonBaseEnhancer", () => {
  let enhancer: ReturnType<typeof createPolygonBaseEnhancer>;

  beforeEach(() => {
    enhancer = createPolygonBaseEnhancer(new MeshLambertMaterial());
  });

  describe("lifecycle", () => {
    it("states() should throw if called before mount", () => {
      const freshEnhancer = createPolygonBaseEnhancer(
        new MeshLambertMaterial(),
      );
      expect(() => freshEnhancer.states()).toThrow(
        "mount() must be called before states",
      );
    });

    it("mutates() should throw if called before mount", () => {
      const freshEnhancer = createPolygonBaseEnhancer(
        new MeshLambertMaterial(),
      );
      expect(() => freshEnhancer.mutates()).toThrow(
        "mount() must be called before mutates",
      );
    });

    it("update() should throw if called before mount", () => {
      const freshEnhancer = createPolygonBaseEnhancer(
        new MeshLambertMaterial(),
      );
      expect(() => freshEnhancer.update({})).toThrow(
        "mount() must be called before update",
      );
    });
  });

  describe("material render state on partial update", () => {
    it("should preserve clampToGround render state when only isTexturized is updated", () => {
      const material = new MeshLambertMaterial();
      const e = createPolygonBaseEnhancer(material);
      e.mount({ clampToGround: true, isTexturized: false });
      expect(material.depthWrite).toBe(false);
      expect(material.depthTest).toBe(false);
      expect(material.colorWrite).toBe(false);

      // Partial update: only isTexturized changes, clampToGround must stay true
      e.update({ isTexturized: true });
      expect(material.depthWrite).toBe(false);
      expect(material.depthTest).toBe(false);
      expect(material.colorWrite).toBe(true); // texturized → no stencil clip
    });

    it("should preserve isTexturized render state when only clampToGround is updated", () => {
      const material = new MeshLambertMaterial();
      const e = createPolygonBaseEnhancer(material);
      e.mount({ clampToGround: false, isTexturized: true });
      expect(material.depthWrite).toBe(true);
      expect(material.depthTest).toBe(true);

      // Partial update: only clampToGround changes, isTexturized must stay true
      e.update({ clampToGround: true });
      expect(material.depthWrite).toBe(false);
      expect(material.depthTest).toBe(false);
      expect(material.colorWrite).toBe(true); // still texturized → no stencil clip
    });
  });

  describe("programCacheKey", () => {
    it("should return cache key based on shader-affecting state", () => {
      enhancer.mount({
        useBatchTexture: true,
        useBatchColorShow: false,
        useBatchHeight: true,
        useBatchExtrudedHeight: false,
      });

      const cacheKey = enhancer.programCacheKey();
      const parsed = JSON.parse(cacheKey);

      expect(parsed).toEqual({
        useBatchTexture: true,
        useBatchColorShow: false,
        useBatchHeight: true,
        useBatchExtrudedHeight: false,
      });
    });

    it("should return different cache keys for different shader-affecting states", () => {
      enhancer.mount({ useBatchTexture: false });
      const cacheKey1 = enhancer.programCacheKey();

      const enhancer2 = createPolygonBaseEnhancer(new MeshLambertMaterial());
      enhancer2.mount({ useBatchTexture: true });
      const cacheKey2 = enhancer2.programCacheKey();

      expect(cacheKey1).not.toBe(cacheKey2);
    });

    it("should return same cache key for same shader-affecting states with different non-affecting states", () => {
      enhancer.mount({ useBatchTexture: true, addHeight: 10, opacity: 0.5 });
      const cacheKey1 = enhancer.programCacheKey();

      const enhancer2 = createPolygonBaseEnhancer(new MeshLambertMaterial());
      enhancer2.mount({ useBatchTexture: true, addHeight: 100, opacity: 1.0 });
      const cacheKey2 = enhancer2.programCacheKey();

      expect(cacheKey1).toBe(cacheKey2);
    });
  });
});
