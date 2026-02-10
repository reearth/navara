import { ShaderMaterial } from "three";
import { describe, expect, it } from "vitest";

import { updateMaterialProps } from "./material";
import type { PolylineBaseProps } from "./types";

describe("polylineBaseEnhancer/material", () => {
  describe("updateMaterialProps", () => {
    it("should not throw when called with empty props", () => {
      const material = new ShaderMaterial();
      const props: PolylineBaseProps = {};

      expect(() => updateMaterialProps(material, props)).not.toThrow();
    });

    it("should not throw when called with color prop", () => {
      const material = new ShaderMaterial();
      const props: PolylineBaseProps = { color: 0xff0000 };

      // Color is handled via uniforms, not direct material property
      expect(() => updateMaterialProps(material, props)).not.toThrow();
    });
  });
});
