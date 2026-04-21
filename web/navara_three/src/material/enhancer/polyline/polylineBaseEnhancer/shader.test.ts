import FlatPolylineFragShader from "@shaders/glsl/flatPolyline.frag.glsl";
import FlatPolylineVertShader from "@shaders/glsl/flatPolyline.vert.glsl";
import PolylineFragShader from "@shaders/glsl/polyline.frag.glsl";
import PolylineVertShader from "@shaders/glsl/polyline.vert.glsl";
import { describe, it, expect } from "vitest";

import { createPolylineBaseEnhancer, type SupportedMaterial } from ".";

describe("polylineBaseEnhancer shader selection", () => {
  it("should use FlatPolyline shaders when isTexturized is true", () => {
    const material = {
      type: "ShaderMaterial",
      userData: {},
    } as unknown as SupportedMaterial;

    const enhancer = createPolylineBaseEnhancer(material);

    // Mount with isTexturized = true
    enhancer.mount({
      isTexturized: true,
    });

    // Create a mock shader object
    const shader = {
      vertexShader: "",
      fragmentShader: "",
      uniforms: {},
      defines: {},
    };

    // Transform the shader
    enhancer.transformShader(shader as any);

    // Verify that FlatPolyline shaders are used
    expect(shader.vertexShader).toBe(FlatPolylineVertShader);
    expect(shader.fragmentShader).toBe(FlatPolylineFragShader);
  });

  it("should use PolylineFragShader when isTexturized is false", () => {
    const material = {
      type: "ShaderMaterial",
      userData: {},
    } as unknown as SupportedMaterial;

    const enhancer = createPolylineBaseEnhancer(material);

    // Mount with isTexturized = false
    enhancer.mount({
      isTexturized: false,
    });

    // Create a mock shader object
    const shader = {
      vertexShader: "",
      fragmentShader: "",
      uniforms: {},
      defines: {},
    };

    // Transform the shader
    enhancer.transformShader(shader as any);

    // Verify that PolylineVertShader and PolylineFragShader are used
    expect(shader.vertexShader).toBe(PolylineVertShader);
    expect(shader.fragmentShader).toContain(PolylineFragShader);
  });
});
