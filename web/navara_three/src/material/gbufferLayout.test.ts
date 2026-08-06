import {
  HalfFloatType,
  NearestFilter,
  UnsignedByteType,
  WebGLRenderTarget,
} from "three";
import { describe, expect, it } from "vitest";

import {
  GBUFFER_ATTACHMENT_NAMES,
  GBUFFER_DEFINE_NAMES,
  GBUFFER_EMISSIVE_LOCATION_DEFINE,
  GBUFFER_PARS_FRAGMENT,
  GBUFFER_TEXTURE_INDEX,
  USE_GBUFFER_EMISSIVE_DEFINE,
  computeGBufferDefines,
  computeGBufferTextureIndex,
  createGBufferAttachments,
  resolveGBufferOptions,
  unionGBufferRequirements,
} from "./gbufferLayout";

describe("gbufferLayout", () => {
  it("keeps the GLSL chunk in sync with the TS define names", () => {
    // Only strings link the two sides: a one-sided rename silently stops the
    // buffer from being written, with no compile error.
    for (const name of GBUFFER_DEFINE_NAMES) {
      expect(GBUFFER_PARS_FRAGMENT).toContain(name);
    }
    // Normal is fixed, so its location stays a literal rather than a define.
    expect(GBUFFER_PARS_FRAGMENT).toContain(
      `layout(location = ${GBUFFER_TEXTURE_INDEX.normal}) out vec4 normalBuffer;`,
    );
  });

  it("packs optional attachment indices without gaps", () => {
    expect(
      computeGBufferTextureIndex(
        resolveGBufferOptions({
          selectiveEffect: true,
          emissive: true,
          shadow: true,
        }),
      ),
    ).toEqual({ color: 0, normal: 1, effectIds: 2, emissive: 3, shadow: 4 });
    // A disabled buffer never leaves a hole: later buffers slide down.
    expect(
      computeGBufferTextureIndex(resolveGBufferOptions({ shadow: true })),
    ).toEqual({ color: 0, normal: 1, shadow: 2 });
    // Defaults allocate no optional buffers.
    expect(computeGBufferTextureIndex(resolveGBufferOptions())).toEqual({
      color: 0,
      normal: 1,
    });
  });

  it("stamps location defines matching the computed indices", () => {
    expect(
      computeGBufferDefines(resolveGBufferOptions({ emissive: true })),
    ).toEqual({
      [USE_GBUFFER_EMISSIVE_DEFINE]: 1,
      [GBUFFER_EMISSIVE_LOCATION_DEFINE]: 2,
    });
    expect(computeGBufferDefines(resolveGBufferOptions())).toEqual({});
  });

  it("derives the buffer configuration as the union of effect requirements", () => {
    expect(unionGBufferRequirements([])).toEqual({
      selectiveEffect: false,
      emissive: false,
      shadow: false,
      globeNormal: false,
    });
    expect(
      unionGBufferRequirements([
        ["selectiveEffect"],
        ["selectiveEffect", "emissive"],
        ["shadow"],
      ]),
    ).toEqual({
      selectiveEffect: true,
      emissive: true,
      shadow: true,
      globeNormal: false,
    });
  });

  it("allocates only enabled attachments, with their texture settings", () => {
    const rt = new WebGLRenderTarget(4, 4);
    const buffers = resolveGBufferOptions({
      selectiveEffect: true,
      emissive: true,
      shadow: true,
    });
    createGBufferAttachments(rt, buffers);

    expect(rt.textures.length).toBe(5);
    const index = computeGBufferTextureIndex(buffers);
    invariantDefined(index.effectIds);
    invariantDefined(index.emissive);
    const effectIds = rt.textures[index.effectIds];
    expect(effectIds.type).toBe(HalfFloatType);
    expect(effectIds.minFilter).toBe(NearestFilter);
    expect(effectIds.magFilter).toBe(NearestFilter);
    expect(rt.textures[index.emissive].type).toBe(HalfFloatType);
    invariantDefined(index.shadow);
    expect(rt.textures[index.shadow].type).toBe(UnsignedByteType);

    // No placeholder textures for disabled buffers – indices would shift.
    const defaultRt = new WebGLRenderTarget(4, 4);
    createGBufferAttachments(defaultRt, resolveGBufferOptions());
    expect(defaultRt.textures.length).toBe(2);
  });
});

function invariantDefined(value: number | undefined): asserts value is number {
  expect(value).toBeDefined();
}

describe("globeNormal", () => {
  // It rides on requiredBuffers but is a separate copy target, not an MRT
  // attachment, so it must not consume a slot, an index, or a location define.
  const buffers = resolveGBufferOptions({ globeNormal: true, shadow: true });

  it("takes no attachment index", () => {
    expect(computeGBufferTextureIndex(buffers)).toEqual({
      color: 0,
      normal: 1,
      shadow: 2,
    });
  });

  it("allocates no texture", () => {
    const rt = new WebGLRenderTarget(4, 4);
    createGBufferAttachments(rt, buffers);
    expect(rt.textures.length).toBe(3);
  });

  it("stamps no define", () => {
    expect(
      computeGBufferDefines(resolveGBufferOptions({ globeNormal: true })),
    ).toEqual({});
  });

  it("is excluded from the attachment-backed names", () => {
    expect(GBUFFER_ATTACHMENT_NAMES).not.toContain("globeNormal");
  });
});
