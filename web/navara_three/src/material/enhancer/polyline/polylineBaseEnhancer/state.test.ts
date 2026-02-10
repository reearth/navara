import { describe, expect, it } from "vitest";

import { DEFAULT_BASE_STATE, updateState } from "./state";
import type { PolylineBaseProps } from "./types";

describe("polylineBaseEnhancer/state", () => {
  describe("updateState", () => {
    it("should initialize state from props with defaults", () => {
      const props: PolylineBaseProps = {
        color: 0xff0000,
        width: 2,
      };

      const state = updateState(props, DEFAULT_BASE_STATE);

      expect(state.width).toBe(2);
      expect(state.useRTE).toBe(false);
      expect(state.pickable).toBe(false);
    });

    it("should update minMaxHeight from props", () => {
      const props: PolylineBaseProps = {
        minMaxHeight: [100, 200],
      };

      const state = updateState(props, DEFAULT_BASE_STATE);

      expect(state.minMaxHeight).toEqual([100, 200]);
    });

    it("should update width from props", () => {
      const props: PolylineBaseProps = {
        width: 5,
      };

      const state = updateState(props, DEFAULT_BASE_STATE);

      expect(state.width).toBe(5);
    });

    it("should disable ground normals when isTexturized is true", () => {
      const props: PolylineBaseProps = {
        isTexturized: true,
        useGroundNormals: true,
      };

      const state = updateState(props, DEFAULT_BASE_STATE);

      expect(state.isTexturized).toBe(true);
      expect(state.useGroundNormals).toBe(false);
    });

    it("should update clampToGround from props", () => {
      const props: PolylineBaseProps = {
        clampToGround: true,
      };

      const state = updateState(props, DEFAULT_BASE_STATE);

      expect(state.clampToGround).toBe(true);
    });

    it("should update batch flags from props", () => {
      const props: PolylineBaseProps = {
        batchColorEnabled: true,
        useBatchTexture: true,
        useBatchColorShow: true,
      };

      const state = updateState(props, DEFAULT_BASE_STATE);

      expect(state.batchColorEnabled).toBe(true);
      expect(state.useBatchTexture).toBe(true);
      expect(state.useBatchColorShow).toBe(true);
    });
  });
});
