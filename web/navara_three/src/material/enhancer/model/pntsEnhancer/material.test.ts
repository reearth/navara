import { PointsMaterial } from "three";
import { describe, expect, it } from "vitest";

import { updateMaterialProps } from "./material";

describe("pntsEnhancer/material", () => {
  describe("updateMaterialProps", () => {
    it("should not update properties when props are undefined", () => {
      const material = new PointsMaterial();
      material.color.set(0xff0000);
      material.size = 5;

      updateMaterialProps(material, {});
      expect(material.color.getHex()).toBe(0xff0000);
      expect(material.size).toBe(5);
    });

    it("should update color when provided", () => {
      const material = new PointsMaterial();
      updateMaterialProps(material, { color: 0x00ff00 });
      expect(material.color.getHex()).toBe(0x00ff00);
    });

    it("should update pointSize when provided", () => {
      const material = new PointsMaterial();
      updateMaterialProps(material, { pointSize: 3 });
      expect(material.size).toBe(3);
    });

    it("should update both color and pointSize when provided", () => {
      const material = new PointsMaterial();
      updateMaterialProps(material, { color: 0x0000ff, pointSize: 7 });
      expect(material.color.getHex()).toBe(0x0000ff);
      expect(material.size).toBe(7);
    });
  });
});
