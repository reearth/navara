import sdfTextFragmentShader from "@shaders/glsl/sdfText.frag.glsl";
import sdfTextVertexShader from "@shaders/glsl/sdfText.vert.glsl";
import { describe, expect, it } from "vitest";

import { LABEL_ROWS, LabelRow } from "./types";

import { createSdfTextBaseEnhancer, type SupportedMaterial } from ".";

describe("sdfTextBaseEnhancer shader", () => {
  const createMockMaterial = () =>
    ({
      type: "ShaderMaterial",
      userData: {},
    }) as unknown as SupportedMaterial;

  const createMockShader = () => ({
    vertexShader: "",
    fragmentShader: "",
    uniforms: {} as Record<string, { value: unknown }>,
    defines: {} as Record<string, unknown>,
  });

  const transform = (
    props: Parameters<ReturnType<typeof createSdfTextBaseEnhancer>["mount"]>[0],
  ) => {
    const enhancer = createSdfTextBaseEnhancer(createMockMaterial());
    enhancer.mount(props);
    const shader = createMockShader();
    enhancer.transformShader(shader as never);
    return shader;
  };

  it("should set correct vertex and fragment shaders", () => {
    const shader = transform({});
    expect(shader.vertexShader).toBe(sdfTextVertexShader);
    expect(shader.fragmentShader).toBe(sdfTextFragmentShader);
  });

  it("should set USE_RTE define only when useRTE=true", () => {
    expect(transform({ useRTE: true }).defines.USE_RTE).toBe(1);
    expect(transform({ useRTE: false }).defines.USE_RTE).toBeUndefined();
  });

  it("should set USE_MSDF define only when useMsdf=true", () => {
    expect(transform({ useMsdf: true }).defines.USE_MSDF).toBe(1);
    expect(transform({ useMsdf: false }).defines.USE_MSDF).toBeUndefined();
  });

  // The shader indexes the label data texture as `slot * LABEL_ROWS + row`.
  // If the define and the CPU-side row table disagree, every label reads
  // another label's state — hence injecting it rather than hard-coding it.
  describe("label data texture contract", () => {
    it("injects LABEL_ROWS as a define", () => {
      expect(transform({}).defines.LABEL_ROWS).toBe(LABEL_ROWS);
    });

    it("keeps LABEL_ROWS in step with the row table", () => {
      const rows = Object.values(LabelRow);
      expect(LABEL_ROWS).toBe(rows.length);
      // Rows must be a dense 0..n-1 range for the stride math to hold.
      expect([...rows].sort((a, b) => a - b)).toEqual(rows.map((_, i) => i));
    });

    it("binds the label texture uniforms", () => {
      const shader = transform({});
      expect(shader.uniforms.uLabelData).toBeDefined();
      expect(shader.uniforms.uLabelTexSize).toBeDefined();
    });
  });

  it("should assign batch-wide uniforms to shader.uniforms", () => {
    const shader = transform({ outlineOpacity: 0.25 });
    expect(shader.uniforms.uCenter).toBeDefined();
    expect(shader.uniforms.uOutlineOpacity?.value).toBe(0.25);
    expect(shader.uniforms.nvr_uPickable).toBeDefined();
  });
});
