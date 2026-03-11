import { type DataTexture, Color } from "three";
import { describe, expect, it, vi } from "vitest";

import type { ShaderUniforms } from "../../MaterialEnhancer";

import { createBaseMutates } from "./mutates";
import { DEFAULT_BASE_STATE } from "./state";
import type { SdfTextBaseState } from "./types";

vi.mock("@navara/engine-api", () => ({
  encodePosition: (_x: number, _y: number, _z: number) => ({
    high: { x: 1000, y: 2000, z: 3000 },
    low: { x: 0.5, y: 0.25, z: 0.125 },
  }),
}));

describe("sdfTextBaseEnhancer/mutates", () => {
  describe("update syncs refs from state", () => {
    it("should sync core refs from state", () => {
      const state: SdfTextBaseState = {
        ...DEFAULT_BASE_STATE,
        color: new Color(0xff0000),
        fontSize: 24,
        center: [0.5, 0.5],
        scaleByDistance: true,
        addHeight: 50,
        offsetDepth: false,
        outlineWidth: 0.1,
        outlineColor: new Color(0x00ff00),
        outlineOpacity: 0.8,
        showBackground: true,
        backgroundColor: new Color(0x0000ff),
        backgroundOutlineColor: new Color(0xffff00),
        backgroundOutlineWidth: 0.2,
        pickable: true,
      };
      const mutates = createBaseMutates(false);
      mutates.update(state);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      expect(uniforms.uColor?.value.getHex()).toBe(0xff0000);
      expect(uniforms.uFontSizePx?.value).toBe(24);
      expect(uniforms.uCenter?.value.x).toBe(0.5);
      expect(uniforms.uCenter?.value.y).toBe(0.5);
      expect(uniforms.uScaleByDistance?.value).toBe(true);
      expect(uniforms.uAddHeight?.value).toBe(50);
      expect(uniforms.uOffsetDepth?.value).toBe(false);
      expect(uniforms.uOutlineWidth?.value).toBe(0.1);
      expect(uniforms.uOutlineColor?.value.getHex()).toBe(0x00ff00);
      expect(uniforms.uOutlineOpacity?.value).toBe(0.8);
      expect(uniforms.uShowBackground?.value).toBe(true);
      expect(uniforms.uBackgroundColor?.value.getHex()).toBe(0x0000ff);
      expect(uniforms.uBackgroundOutlineColor?.value.getHex()).toBe(0xffff00);
      expect(uniforms.uBackgroundOutlineWidth?.value).toBe(0.2);
      expect(uniforms.nvr_uPickable?.value).toBe(1.0);
    });
  });

  describe("RTC center", () => {
    it("should initialize uRTCCenter from constructor args", () => {
      const state: SdfTextBaseState = { ...DEFAULT_BASE_STATE };
      const mutates = createBaseMutates(false, [10, 20, 30]);
      mutates.update(state);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      expect(uniforms.uRTCCenter?.value.x).toBe(10);
      expect(uniforms.uRTCCenter?.value.y).toBe(20);
      expect(uniforms.uRTCCenter?.value.z).toBe(30);
    });
  });

  describe("RTE position refs", () => {
    it("should create RTE position uniforms when useRTE=true", () => {
      const state: SdfTextBaseState = {
        ...DEFAULT_BASE_STATE,
        useRTE: true,
      };
      const mutates = createBaseMutates(true);
      mutates.update(state);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      expect(uniforms.uRTEPositionLOW).toBeDefined();
      expect(uniforms.uRTEPositionHIGH).toBeDefined();
      expect(uniforms.uRTCPosition).toBeUndefined();
    });

    it("should create RTC position uniform when useRTE=false", () => {
      const state: SdfTextBaseState = { ...DEFAULT_BASE_STATE };
      const mutates = createBaseMutates(false);
      mutates.update(state);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      expect(uniforms.uRTCPosition).toBeDefined();
      expect(uniforms.uRTEPositionLOW).toBeUndefined();
      expect(uniforms.uRTEPositionHIGH).toBeUndefined();
    });
  });

  describe("atlas texture ref", () => {
    it("should update uAtlas value without replacing uniform ref", () => {
      const state: SdfTextBaseState = { ...DEFAULT_BASE_STATE };
      const mutates = createBaseMutates(false);
      mutates.update(state);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);
      const initialAtlasUniform = uniforms.uAtlas;
      expect(initialAtlasUniform).toBeDefined();
      expect(initialAtlasUniform?.value).toBeNull();

      const nextTexture = {
        image: { width: 256, height: 256, data: new Uint8Array(256 * 256) },
      } as unknown as DataTexture;

      mutates.setAtlasTexture({ value: nextTexture });

      expect(uniforms.uAtlas).toBe(initialAtlasUniform);
      expect(uniforms.uAtlas?.value).toBe(nextTexture);
    });
  });

  describe("updatePerFrame", () => {
    it("should update camera uniforms", () => {
      const state: SdfTextBaseState = { ...DEFAULT_BASE_STATE };
      const mutates = createBaseMutates(false);
      mutates.update(state);

      mutates.updatePerFrame(1.5, 1080, 10000, 0, 0, 0, state);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      expect(uniforms.uFov?.value).toBe(1.5);
      expect(uniforms.uScreenHeightPx?.value).toBe(1080);
      expect(uniforms.uFarPlane?.value).toBe(10000);
    });

    it("should update RTE eye uniforms when useRTE=true", () => {
      const state: SdfTextBaseState = {
        ...DEFAULT_BASE_STATE,
        useRTE: true,
      };
      const mutates = createBaseMutates(true);
      mutates.update(state);

      mutates.updatePerFrame(1.0, 1080, 1000, 100, 200, 300, state);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      const eyeHigh = uniforms.uEyeRTEHigh?.value;
      const eyeLow = uniforms.uEyeRTELow?.value;
      expect(eyeHigh).toBeDefined();
      expect(eyeLow).toBeDefined();
      // Values come from the mocked encodePosition
      expect(eyeHigh?.x).toBe(1000);
      expect(eyeLow?.x).toBe(0.5);
    });

    it("should not update RTE eye uniforms when useRTE=false", () => {
      const state: SdfTextBaseState = { ...DEFAULT_BASE_STATE };
      const mutates = createBaseMutates(false);
      mutates.update(state);

      mutates.updatePerFrame(1.0, 1080, 1000, 100, 200, 300, state);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      expect(uniforms.uEyeRTEHigh?.value.x).toBe(0);
      expect(uniforms.uEyeRTEHigh?.value.y).toBe(0);
      expect(uniforms.uEyeRTEHigh?.value.z).toBe(0);
    });
  });

  describe("updateTextDimensions", () => {
    it("should update text dimension uniforms", () => {
      const state: SdfTextBaseState = { ...DEFAULT_BASE_STATE };
      const mutates = createBaseMutates(false);
      mutates.update(state);

      mutates.updateTextDimensions(5.0, 1.0, -0.2, 0.8);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      expect(uniforms.uTextWidth?.value).toBe(5.0);
      expect(uniforms.uTextHeight?.value).toBe(1.0);
      expect(uniforms.uBgYBounds?.value.x).toBe(-0.2);
      expect(uniforms.uBgYBounds?.value.y).toBe(0.8);
    });
  });

  describe("setPosition", () => {
    it("should set RTE position uniforms", () => {
      const state: SdfTextBaseState = {
        ...DEFAULT_BASE_STATE,
        useRTE: true,
      };
      const mutates = createBaseMutates(true);
      mutates.update(state);

      const high = new Float32Array([100, 200, 300]);
      const low = new Float32Array([0.1, 0.2, 0.3]);
      mutates.setPosition({ high, low }, true);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      expect(uniforms.uRTEPositionHIGH?.value.x).toBe(100);
      expect(uniforms.uRTEPositionLOW?.value.x).toBeCloseTo(0.1);
    });

    it("should set RTC position uniforms", () => {
      const state: SdfTextBaseState = { ...DEFAULT_BASE_STATE };
      const mutates = createBaseMutates(false);
      mutates.update(state);

      const pos = new Float32Array([10, 20, 30]);
      mutates.setPosition(pos, false, [100, 200, 300]);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      expect(uniforms.uRTCPosition?.value.x).toBe(10);
      expect(uniforms.uRTCPosition?.value.y).toBe(20);
      expect(uniforms.uRTCCenter?.value.x).toBe(100);
      expect(uniforms.uRTCCenter?.value.y).toBe(200);
    });
  });

  describe("setBatchId", () => {
    it("should update nvr_uBatchId value", () => {
      const state: SdfTextBaseState = { ...DEFAULT_BASE_STATE };
      const mutates = createBaseMutates(false);
      mutates.update(state);

      mutates.setBatchId(42);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      expect(uniforms.nvr_uBatchId?.value).toBe(42);
    });
  });
});
