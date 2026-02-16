import { defaults } from "lodash-es";
import type { WebGLProgramParametersWithUniforms } from "three";
import invariant from "tiny-invariant";

import type { MaterialEnhancer } from "../../MaterialEnhancer";

import { AVAILABLE_SHADERS, type SupportedMaterial } from "./material";
import { updateMaterialProps } from "./material";
import { createPntsMutates } from "./mutates";
import { transformShader } from "./shader";
import { DEFAULT_PNTS_PROPS, DEFAULT_PNTS_STATE, updateState } from "./state";
import type { PntsMutates, PntsProps, PntsState } from "./types";

/**
 * Factory function to create a PNTS (point cloud) material enhancer.
 *
 * This enhancer handles:
 * - Point size
 * - Color
 * - Height offset via geodetic normal
 * - PNTS color range normalization (1/65535)
 *
 * @param material - The Three.js PointsMaterial to enhance
 */
export function createPntsEnhancer(
  material: SupportedMaterial,
): MaterialEnhancer<
  SupportedMaterial,
  PntsProps,
  PntsState,
  PntsMutates,
  typeof AVAILABLE_SHADERS
> {
  let state: PntsState | null = null;
  let mutates: PntsMutates | null = null;

  return {
    material,
    availableShaders: AVAILABLE_SHADERS,

    transformShader: (shader: WebGLProgramParametersWithUniforms): void => {
      invariant(
        state && mutates,
        "mount() must be called before transformShader",
      );
      transformShader(shader, state, mutates);
    },

    mount: (props: PntsProps): void => {
      const mergedProps = defaults({}, props, DEFAULT_PNTS_PROPS);
      state = updateState(mergedProps, DEFAULT_PNTS_STATE);
      mutates = createPntsMutates();
      mutates.update(state);
      updateMaterialProps(material, mergedProps);
    },

    update: (props: PntsProps): void => {
      invariant(state && mutates, "mount() must be called before update");
      state = updateState(props, state);
      mutates.update(state);
      updateMaterialProps(material, props);
    },

    states: (): PntsState => {
      invariant(state, "mount() must be called before states");
      return state;
    },

    mutates: (): PntsMutates => {
      invariant(mutates, "mount() must be called before mutates");
      return mutates;
    },

    programCacheKey: (): string => {
      // PNTS has no state that affects shader defines
      return "";
    },
  };
}

export type { PntsMutates, PntsProps, PntsState };
export type { SupportedMaterial } from "./material";
