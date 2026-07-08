import { ShaderMaterial } from "three";
import { describe, expect, it } from "vitest";

import { updateMaterialProps } from "./material";

describe("polylineBaseEnhancer/material", () => {
  describe("updateMaterialProps", () => {
    it("should not update properties when props are undefined", () => {
      const material = new ShaderMaterial();
      material.transparent = true;
      material.depthWrite = false;

      updateMaterialProps(material, {});

      expect(material.transparent).toBe(true);
      expect(material.depthWrite).toBe(false);
    });

    it("should update transparent when provided", () => {
      const material = new ShaderMaterial();
      material.transparent = false;

      updateMaterialProps(material, { transparent: true });
      expect(material.transparent).toBe(true);
    });

    it("should update depthWrite when provided", () => {
      const material = new ShaderMaterial();
      material.depthWrite = true;

      updateMaterialProps(material, { depthWrite: false });
      expect(material.depthWrite).toBe(false);
    });

    it("should update opacity when provided", () => {
      const material = new ShaderMaterial();
      material.opacity = 1.0;
      updateMaterialProps(material, { opacity: 0.5 });
      expect(material.opacity).toBe(0.5);
    });
  });
});
