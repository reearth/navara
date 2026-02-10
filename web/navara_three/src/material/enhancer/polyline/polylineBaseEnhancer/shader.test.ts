import { ShaderMaterial } from "three";
import { describe, expect, it } from "vitest";

import { createPolylineBaseEnhancer } from "./index";

describe("polylineBaseEnhancer/shader", () => {
  describe("shader selection", () => {
    it("should use flat shaders when isTexturized", () => {
      const material = new ShaderMaterial();
      const enhancer = createPolylineBaseEnhancer(material);

      enhancer.mount({ isTexturized: true });

      const shader = {
        uniforms: {},
        vertexShader: "",
        fragmentShader: "",
        defines: {},
      } as any;

      enhancer.transformShader(shader);

      // Flat shaders should not have packing import
      expect(shader.fragmentShader).not.toContain("#include <packing>");
    });

    it("should use ground shader when clampToGround and not texturized", () => {
      const material = new ShaderMaterial();
      const enhancer = createPolylineBaseEnhancer(material);

      enhancer.mount({ clampToGround: true, isTexturized: false });

      const shader = {
        uniforms: {},
        vertexShader: "",
        fragmentShader: "",
        defines: {},
      } as any;

      enhancer.transformShader(shader);

      // Ground shader should have packing import
      expect(shader.fragmentShader).toContain("#include <packing>");
    });

    it("should use regular shader when not clamped and not texturized", () => {
      const material = new ShaderMaterial();
      const enhancer = createPolylineBaseEnhancer(material);

      enhancer.mount({ clampToGround: false, isTexturized: false });

      const shader = {
        uniforms: {},
        vertexShader: "",
        fragmentShader: "",
        defines: {},
      } as any;

      enhancer.transformShader(shader);

      // Regular shader should have packing import
      expect(shader.fragmentShader).toContain("#include <packing>");
    });
  });

  describe("shader defines", () => {
    it("should set USE_RTE define when useRTE is true", () => {
      const material = new ShaderMaterial();
      const enhancer = createPolylineBaseEnhancer(material);

      enhancer.mount({ useRTE: true });

      const shader = {
        uniforms: {},
        vertexShader: "",
        fragmentShader: "",
        defines: {},
      } as any;

      enhancer.transformShader(shader);

      expect(shader.defines.USE_RTE).toBe(true);
    });

    it("should merge defines from material.userData.defines", () => {
      const material = new ShaderMaterial();
      material.userData.defines = {
        USE_BATCH_TEXTURE: true,
        USE_BATCH_COLOR_SHOW: true,
      };
      const enhancer = createPolylineBaseEnhancer(material);

      enhancer.mount({});

      const shader = {
        uniforms: {},
        vertexShader: "",
        fragmentShader: "",
        defines: {},
      } as any;

      enhancer.transformShader(shader);

      // Batch defines come from material.userData.defines
      expect(shader.defines.USE_BATCH_TEXTURE).toBe(true);
      expect(shader.defines.USE_BATCH_COLOR_SHOW).toBe(true);
    });
  });

  describe("uniform initialization", () => {
    it("should include lighting uniforms in shader", () => {
      const material = new ShaderMaterial();
      const enhancer = createPolylineBaseEnhancer(material);

      enhancer.mount({});

      const shader = {
        uniforms: {},
        vertexShader: "",
        fragmentShader: "",
        defines: {},
      } as any;

      enhancer.transformShader(shader);

      // Should have light uniforms from UniformsLib["lights"]
      expect(shader.uniforms.directionalLights).toBeDefined();
      expect(shader.uniforms.pointLights).toBeDefined();
      expect(shader.uniforms.spotLights).toBeDefined();
    });

    it("should include all core uniforms", () => {
      const material = new ShaderMaterial();
      const enhancer = createPolylineBaseEnhancer(material);

      enhancer.mount({});

      const shader = {
        uniforms: {},
        vertexShader: "",
        fragmentShader: "",
        defines: {},
      } as any;

      enhancer.transformShader(shader);

      expect(shader.uniforms.minMaxHeightAndWidth).toBeDefined();
      expect(shader.uniforms.color).toBeDefined();
      expect(shader.uniforms.useGroundNormals).toBeDefined();
      expect(shader.uniforms.nvr_uPickable).toBeDefined();
      expect(shader.uniforms.nvr_uPickingCoord).toBeDefined();
    });
  });
});
