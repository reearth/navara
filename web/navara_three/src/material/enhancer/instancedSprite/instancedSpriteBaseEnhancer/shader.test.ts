import instancedSpriteFragmentShader from "@shaders/glsl/instancedSprite.frag.glsl";
import instancedSpriteVertexShader from "@shaders/glsl/instancedSprite.vert.glsl";
import { describe, expect, it } from "vitest";

import { createInstancedSpriteBaseEnhancer, type SupportedMaterial } from ".";

describe("instancedSpriteBaseEnhancer shader", () => {
  const createMockMaterial = () =>
    ({
      type: "ShaderMaterial",
      userData: {},
    }) as unknown as SupportedMaterial;

  const createMockShader = () => ({
    vertexShader: "",
    fragmentShader: "",
    uniforms: {},
    defines: {} as Record<string, unknown>,
  });

  it("should set correct vertex and fragment shaders", () => {
    const material = createMockMaterial();
    const enhancer = createInstancedSpriteBaseEnhancer(material);
    enhancer.mount({});

    const shader = createMockShader();
    enhancer.transformShader(shader as any);

    expect(shader.vertexShader).toBe(instancedSpriteVertexShader);
    expect(shader.fragmentShader).toBe(instancedSpriteFragmentShader);
  });

  it("should set USE_RTE define when useRTE=true", () => {
    const material = createMockMaterial();
    const enhancer = createInstancedSpriteBaseEnhancer(material);
    enhancer.mount({ useRTE: true });

    const shader = createMockShader();
    enhancer.transformShader(shader as any);

    expect(shader.defines.USE_RTE).toBe(1);
  });

  it("should not set USE_RTE define when useRTE=false", () => {
    const material = createMockMaterial();
    const enhancer = createInstancedSpriteBaseEnhancer(material);
    enhancer.mount({ useRTE: false });

    const shader = createMockShader();
    enhancer.transformShader(shader as any);

    expect(shader.defines.USE_RTE).toBeUndefined();
  });

  it("should set BILLBOARD define when billboard=true", () => {
    const material = createMockMaterial();
    const enhancer = createInstancedSpriteBaseEnhancer(material);
    enhancer.mount({ billboard: true });

    const shader = createMockShader();
    enhancer.transformShader(shader as any);

    expect(shader.defines.BILLBOARD).toBe(1);
  });

  it("should not set BILLBOARD define when billboard=false", () => {
    const material = createMockMaterial();
    const enhancer = createInstancedSpriteBaseEnhancer(material);
    enhancer.mount({ billboard: false });

    const shader = createMockShader();
    enhancer.transformShader(shader as any);

    expect(shader.defines.BILLBOARD).toBeUndefined();
  });

  it("should set both USE_RTE and BILLBOARD when both are true", () => {
    const material = createMockMaterial();
    const enhancer = createInstancedSpriteBaseEnhancer(material);
    enhancer.mount({ useRTE: true, billboard: true });

    const shader = createMockShader();
    enhancer.transformShader(shader as any);

    expect(shader.defines.USE_RTE).toBe(1);
    expect(shader.defines.BILLBOARD).toBe(1);
  });

  it("should merge material.userData.defines", () => {
    const material = createMockMaterial();
    material.userData.defines = { CUSTOM_DEFINE: 1 };
    const enhancer = createInstancedSpriteBaseEnhancer(material);
    enhancer.mount({});

    const shader = createMockShader();
    enhancer.transformShader(shader as any);

    expect(shader.defines.CUSTOM_DEFINE).toBe(1);
  });

  it("should assign uniforms to shader.uniforms", () => {
    const material = createMockMaterial();
    const enhancer = createInstancedSpriteBaseEnhancer(material);
    enhancer.mount({ scale: 200 });

    const shader = createMockShader();
    enhancer.transformShader(shader as any);

    expect((shader.uniforms as Record<string, unknown>).uScale).toBeDefined();
    expect(
      (shader.uniforms as Record<string, { value: unknown }>).uScale.value,
    ).toBe(200);
  });
});
