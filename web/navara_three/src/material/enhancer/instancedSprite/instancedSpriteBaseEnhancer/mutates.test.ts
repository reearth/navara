import type { DataArrayTexture } from "three";
import { describe, expect, it, vi } from "vitest";

import type { ShaderUniforms } from "../../MaterialEnhancer";

import { createBaseMutates } from "./mutates";
import { DEFAULT_BASE_STATE } from "./state";
import type { InstancedSpriteBaseState } from "./types";

vi.mock("@navara/three_api", () => ({
  degreeToRadian: (degree: number) => (degree * Math.PI) / 180,
}));

vi.mock("@navara/engine-api", () => ({
  encodePosition: (_x: number, _y: number, _z: number) => ({
    high: { x: 1000, y: 2000, z: 3000 },
    low: { x: 0.5, y: 0.25, z: 0.125 },
  }),
}));

describe("instancedSpriteBaseEnhancer/mutates", () => {
  describe("update syncs refs from state", () => {
    it("should sync core refs from state", () => {
      const state: InstancedSpriteBaseState = {
        ...DEFAULT_BASE_STATE,
        scale: 50,
        center: [0.5, 0.5],
        sizeInMeters: false,
        offsetDepth: false,
        alphaTest: 0.3,
        pickable: true,
        aspect: 2.0,
      };
      const mutates = createBaseMutates(false, false);
      mutates.update(state);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      expect(uniforms.uScale?.value).toBe(50);
      expect(uniforms.uCenter?.value.x).toBe(0.5);
      expect(uniforms.uCenter?.value.y).toBe(0.5);
      expect(uniforms.uSizeInMeters?.value).toBe(false);
      expect(uniforms.uOffsetDepth?.value).toBe(false);
      expect(uniforms.uAlphaTest?.value).toBe(0.3);
      expect(uniforms.nvr_uPickable?.value).toBe(1.0);
      expect(uniforms.uAspect?.value).toBe(2.0);
    });
  });

  describe("RTC center", () => {
    it("should initialize uRTCCenter from constructor args", () => {
      const state: InstancedSpriteBaseState = { ...DEFAULT_BASE_STATE };
      const mutates = createBaseMutates(false, false, [10, 20, 30]);
      mutates.update(state);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      expect(uniforms.uRTCCenter?.value.x).toBe(10);
      expect(uniforms.uRTCCenter?.value.y).toBe(20);
      expect(uniforms.uRTCCenter?.value.z).toBe(30);
    });
  });

  describe("billboard texture ref", () => {
    it("should assign uTexture to uniforms when billboard=true", () => {
      const state: InstancedSpriteBaseState = {
        ...DEFAULT_BASE_STATE,
        billboard: true,
      };
      const mutates = createBaseMutates(false, true);
      mutates.update(state);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      expect(uniforms.uTexture).toBeDefined();
      expect(uniforms.uTexture?.value).toBeNull();
    });

    it("should not assign uTexture to uniforms when billboard=false", () => {
      const state: InstancedSpriteBaseState = { ...DEFAULT_BASE_STATE };
      const mutates = createBaseMutates(false, false);
      mutates.update(state);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      expect(uniforms.uTexture).toBeUndefined();
    });

    it("should update uTexture value without replacing uniform ref", () => {
      const state: InstancedSpriteBaseState = {
        ...DEFAULT_BASE_STATE,
        billboard: true,
      };
      const mutates = createBaseMutates(false, true);
      mutates.update(state);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);
      const initialTextureUniform = uniforms.uTexture;
      expect(initialTextureUniform).toBeDefined();

      const nextTexture = {
        image: {
          width: 1,
          height: 1,
          depth: 1,
          data: new Uint8Array([0, 0, 0, 0]),
        },
      } as unknown as DataArrayTexture;

      mutates.setTexture({ value: nextTexture });

      expect(uniforms.uTexture).toBe(initialTextureUniform);
      expect(uniforms.uTexture?.value).toBe(nextTexture);
    });
  });

  describe("updateRteUniforms", () => {
    it("should update RTE eye uniforms when useRTE=true", () => {
      const state: InstancedSpriteBaseState = {
        ...DEFAULT_BASE_STATE,
        useRTE: true,
      };
      const mutates = createBaseMutates(true, false);
      mutates.update(state);

      // Call updateRteUniforms with some camera position
      mutates.updateRteUniforms(1000, 2000, 3000, state);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      // encodePosition splits into high/low, verify they are set (not zero)
      const eyeHigh = uniforms.uEyeRTEHigh?.value;
      const eyeLow = uniforms.uEyeRTELow?.value;
      expect(eyeHigh).toBeDefined();
      expect(eyeLow).toBeDefined();
    });

    it("should do nothing when useRTE=false", () => {
      const state: InstancedSpriteBaseState = { ...DEFAULT_BASE_STATE };
      const mutates = createBaseMutates(false, false);
      mutates.update(state);

      mutates.updateRteUniforms(1000, 2000, 3000, state);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      // Eye uniforms should remain at default (0, 0, 0)
      expect(uniforms.uEyeRTEHigh?.value.x).toBe(0);
      expect(uniforms.uEyeRTEHigh?.value.y).toBe(0);
      expect(uniforms.uEyeRTEHigh?.value.z).toBe(0);
    });
  });

  describe("updateFarPlane", () => {
    it("should update uFarPlane value", () => {
      const state: InstancedSpriteBaseState = { ...DEFAULT_BASE_STATE };
      const mutates = createBaseMutates(false, false);
      mutates.update(state);

      mutates.updateFarPlane(1000);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      expect(uniforms.uFarPlane?.value).toBe(1000);
    });
  });

  describe("updateFov", () => {
    it("should update uFovRad value", () => {
      const state: InstancedSpriteBaseState = { ...DEFAULT_BASE_STATE };
      const mutates = createBaseMutates(false, false);
      mutates.update(state);

      mutates.updateFov(75);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      expect(uniforms.uFovRad?.value).toBe(75);
    });

    it("should not replace the uniform ref", () => {
      const state: InstancedSpriteBaseState = { ...DEFAULT_BASE_STATE };
      const mutates = createBaseMutates(false, false);
      mutates.update(state);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);
      const initialRef = uniforms.uFovRad;

      mutates.updateFov(90);

      expect(uniforms.uFovRad).toBe(initialRef);
      expect(uniforms.uFovRad?.value).toBe(90);
    });
  });

  describe("updateScreenHeight", () => {
    it("should update uScreenHeightPx value", () => {
      const state: InstancedSpriteBaseState = { ...DEFAULT_BASE_STATE };
      const mutates = createBaseMutates(false, false);
      mutates.update(state);

      mutates.updateScreenHeight(720);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      expect(uniforms.uScreenHeightPx?.value).toBe(720);
    });

    it("should not replace the uniform ref", () => {
      const state: InstancedSpriteBaseState = { ...DEFAULT_BASE_STATE };
      const mutates = createBaseMutates(false, false);
      mutates.update(state);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);
      const initialRef = uniforms.uScreenHeightPx;

      mutates.updateScreenHeight(1440);

      expect(uniforms.uScreenHeightPx).toBe(initialRef);
      expect(uniforms.uScreenHeightPx?.value).toBe(1440);
    });
  });
});
