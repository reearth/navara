import { MeshStandardMaterial } from "three";
import { describe, expect, it } from "vitest";

import { updateMaterialProps } from "./material";

describe("modelBaseEnhancer/material", () => {
  describe("updateMaterialProps", () => {
    it("should not update properties when props are undefined", () => {
      const material = new MeshStandardMaterial();
      material.color.set(0xff0000);
      material.metalness = 0.5;
      material.roughness = 0.3;

      updateMaterialProps(material, {});
      expect(material.color.getHex()).toBe(0xff0000);
      expect(material.metalness).toBe(0.5);
      expect(material.roughness).toBe(0.3);
    });

    it("should update color when provided", () => {
      const material = new MeshStandardMaterial();
      updateMaterialProps(material, { color: 0x00ff00 });
      expect(material.color.getHex()).toBe(0x00ff00);
    });

    it("should update metalness and roughness when provided", () => {
      const material = new MeshStandardMaterial();
      updateMaterialProps(material, { metalness: 0.8, roughness: 0.2 });
      expect(material.metalness).toBe(0.8);
      expect(material.roughness).toBe(0.2);
    });

    it("should update emissive properties when provided", () => {
      const material = new MeshStandardMaterial();
      updateMaterialProps(material, {
        emissiveColor: 0xff0000,
        emissiveIntensity: 0.5,
      });
      expect(material.emissive.getHex()).toBe(0xff0000);
      expect(material.emissiveIntensity).toBe(0.5);
    });
  });
});
