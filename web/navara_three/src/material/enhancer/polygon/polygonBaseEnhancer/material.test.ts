import { MeshLambertMaterial } from "three";
import { describe, expect, it } from "vitest";

import { updateMaterialProps } from "./material";

describe("polygonBaseEnhancer/material", () => {
  describe("updateMaterialProps", () => {
    it("should not update properties when props are undefined", () => {
      const material = new MeshLambertMaterial();
      material.color.set(0xff0000);
      material.opacity = 0.5;

      // Empty props should not change anything
      updateMaterialProps(material, {});
      expect(material.color.getHex()).toBe(0xff0000);
      expect(material.opacity).toBe(0.5);
    });
  });

  describe("material render state", () => {
    it("should set colorWrite false when clampToGround and not texturized", () => {
      const material = new MeshLambertMaterial();
      updateMaterialProps(material, {
        clampToGround: true,
        isTexturized: false,
      });
      expect(material.colorWrite).toBe(false);
      expect(material.depthWrite).toBe(false);
      expect(material.depthTest).toBe(false);
    });

    it("should set colorWrite true when texturized", () => {
      const material = new MeshLambertMaterial();
      updateMaterialProps(material, {
        clampToGround: true,
        isTexturized: true,
      });
      expect(material.colorWrite).toBe(true);
      expect(material.depthWrite).toBe(false);
      expect(material.depthTest).toBe(false);
    });

    it("should set depthWrite/depthTest true when not clamped to ground", () => {
      const material = new MeshLambertMaterial();
      updateMaterialProps(material, {
        clampToGround: false,
        isTexturized: false,
      });
      expect(material.colorWrite).toBe(true);
      expect(material.depthWrite).toBe(true);
      expect(material.depthTest).toBe(true);
    });

    it("should compute render state with defaults when neither clampToGround nor isTexturized is provided", () => {
      const material = new MeshLambertMaterial();
      // Both default to false: clampToGround=false, isTexturized=false
      updateMaterialProps(material, { color: 0xff0000 });
      expect(material.colorWrite).toBe(true);
      expect(material.depthWrite).toBe(true);
      expect(material.depthTest).toBe(true);
    });
  });
});
