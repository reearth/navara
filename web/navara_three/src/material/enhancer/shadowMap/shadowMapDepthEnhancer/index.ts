import { defaults } from "lodash-es";
import type { WebGLProgramParametersWithUniforms } from "three";
import invariant from "tiny-invariant";

import type { MaterialEnhancer } from "../../MaterialEnhancer";

import { AVAILABLE_SHADERS, type SupportedMaterial } from "./material";
import { createShadowMapDepthMutates } from "./mutates";
import { transformShader } from "./shader";
import {
  DEFAULT_SHADOW_MAP_DEPTH_PROPS,
  DEFAULT_SHADOW_MAP_DEPTH_STATE,
  updateState,
} from "./state";
import type {
  ShadowMapDepthMutates,
  ShadowMapDepthProps,
  ShadowMapDepthState,
} from "./types";

/**
 * Factory function to create a shadow map depth enhancer.
 *
 * This enhancer handles shadow map depth shader injection.
 * It's designed to be used with customDepthMaterial for shadow map generation.
 *
 * @param material - The Three.js material to enhance
 */
export function createShadowMapDepthEnhancer(
  material: SupportedMaterial,
): MaterialEnhancer<
  SupportedMaterial,
  ShadowMapDepthProps,
  ShadowMapDepthState,
  ShadowMapDepthMutates,
  typeof AVAILABLE_SHADERS
> {
  // Internal state - immutable, always replaced as a whole
  let state: ShadowMapDepthState | null = null;
  // Internal mutates object (refs are external, set via props)
  let mutates: ShadowMapDepthMutates | null = null;

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

    mount: (props: ShadowMapDepthProps): void => {
      const mergedProps = defaults({}, props, DEFAULT_SHADOW_MAP_DEPTH_PROPS);
      state = updateState(mergedProps, DEFAULT_SHADOW_MAP_DEPTH_STATE);
      // Create mutates
      mutates = createShadowMapDepthMutates();
      mutates.update(state);
    },

    update: (props: ShadowMapDepthProps): void => {
      invariant(state && mutates, "mount() must be called before update");
      state = updateState(props, state);
      mutates.update(state);
    },

    states: (): ShadowMapDepthState => {
      invariant(state, "mount() must be called before states");
      return state;
    },

    mutates: (): ShadowMapDepthMutates => {
      invariant(mutates, "mount() must be called before mutates");
      return mutates;
    },

    programCacheKey: (): string => {
      invariant(state, "mount() must be called before programCacheKey");
      // RTE is always enabled for this enhancer
      return JSON.stringify({});
    },
  };
}

// Re-export public types
export type { ShadowMapDepthMutates, ShadowMapDepthProps, ShadowMapDepthState };

// Re-export SupportedMaterial
export type { SupportedMaterial } from "./material";

// Re-export marker types for composing enhancers
export {
  SHADOW_MAP_DEPTH_SHADER_MARKERS,
  createShadowMapDepthShaderReplacer,
} from "./markers";
