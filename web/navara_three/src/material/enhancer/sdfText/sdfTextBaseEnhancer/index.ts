import { defaults } from "lodash-es";
import type { WebGLProgramParametersWithUniforms } from "three";
import invariant from "tiny-invariant";

import type { MaterialEnhancer } from "../../MaterialEnhancer";

import {
  AVAILABLE_SHADERS,
  type SupportedMaterial,
  updateMaterialProps,
} from "./material";
import { createBaseMutates } from "./mutates";
import { transformShader } from "./shader";
import { DEFAULT_BASE_PROPS, DEFAULT_BASE_STATE, updateState } from "./state";
import type {
  SdfTextBaseMutates,
  SdfTextBaseProps,
  SdfTextBaseState,
} from "./types";

/**
 * Factory function to create an sdfText base enhancer.
 *
 * This enhancer handles:
 * - Text color, font size, centering
 * - Outline (width, color, opacity)
 * - Background quad (color, border)
 * - Height offset, depth offset
 * - Picking
 * - RTE (Relative-To-Eye) support for high-precision coordinates
 * - Billboard scaling by distance
 * - SDF atlas texture management
 *
 * Supports ShaderMaterial with custom sdfText shaders.
 *
 * @param material - The Three.js ShaderMaterial to enhance
 */
export function createSdfTextBaseEnhancer(
  material: SupportedMaterial,
): MaterialEnhancer<
  SupportedMaterial,
  SdfTextBaseProps,
  SdfTextBaseState,
  SdfTextBaseMutates,
  typeof AVAILABLE_SHADERS
> {
  // Internal state - immutable, always replaced as a whole
  let state: SdfTextBaseState | null = null;
  // Internal mutates object (refs are hidden inside)
  let mutates: SdfTextBaseMutates | null = null;

  return {
    material,
    availableShaders: AVAILABLE_SHADERS,

    transformShader: (shader: WebGLProgramParametersWithUniforms): void => {
      invariant(
        state && mutates,
        "mount() must be called before transformShader",
      );
      transformShader(shader, state, mutates, material);
    },

    mount: (props: SdfTextBaseProps): void => {
      const mergedProps = defaults({}, props, DEFAULT_BASE_PROPS);
      // Create initial state with immutable fields from props
      const initialState = {
        ...DEFAULT_BASE_STATE,
        useRTE: mergedProps.useRTE,
      };
      state = updateState(mergedProps, initialState);
      // Create mutates (refs are created inside with default values)
      mutates = createBaseMutates(mergedProps.useRTE, mergedProps.rtcCenter);
      mutates.update(state);

      // Set atlas texture external ref if provided
      if (props.atlasTexture) {
        mutates.setAtlasTexture(props.atlasTexture);
      }

      updateMaterialProps(material, mergedProps);
    },

    update: (props: SdfTextBaseProps): void => {
      invariant(state && mutates, "mount() must be called before update");

      state = updateState(props, state);
      mutates.update(state);

      if (props.atlasTexture) {
        mutates.setAtlasTexture(props.atlasTexture);
      }

      updateMaterialProps(material, props);
    },

    states: (): SdfTextBaseState => {
      invariant(state, "mount() must be called before states");
      return state;
    },

    mutates: (): SdfTextBaseMutates => {
      invariant(mutates, "mount() must be called before mutates");
      return mutates;
    },

    programCacheKey: (): string => {
      invariant(state, "mount() must be called before programCacheKey");
      return JSON.stringify({
        useRTE: state.useRTE,
        userDataDefines: material.userData?.defines ?? undefined,
      });
    },
  };
}

// Re-export public types
export type { SdfTextBaseMutates, SdfTextBaseProps, SdfTextBaseState };

// Re-export SupportedMaterial for use by composing enhancers
export type { SupportedMaterial } from "./material";

// Re-export marker types for composing enhancers
export {
  SDF_TEXT_BASE_SHADER_MARKERS,
  createSdfTextBaseShaderReplacer,
} from "./markers";
