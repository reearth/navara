import sdfTextFragmentShader from "@shaders/glsl/sdfText.frag.glsl";
import sdfTextVertexShader from "@shaders/glsl/sdfText.vert.glsl";
import type { WebGLProgramParametersWithUniforms } from "three";

import type { SdfTextBaseMutates, SdfTextBaseState } from "./types";

/**
 * Transform shader with sdfText base modifications.
 *
 * SdfText uses custom ShaderMaterial shaders. This function:
 * 1. Sets the vertex/fragment shader sources
 * 2. Sets defines based on state (USE_RTE)
 * 3. Assigns uniform refs via mutates.updateUniforms()
 */
export const transformShader = (
  shader: WebGLProgramParametersWithUniforms,
  state: SdfTextBaseState,
  mutates: SdfTextBaseMutates,
): void => {
  // Set shaders — sdfText always uses the same shader pair
  shader.vertexShader = sdfTextVertexShader;
  shader.fragmentShader = sdfTextFragmentShader;

  // Set defines based on state
  shader.defines ??= {};

  if (state.useRTE) {
    shader.defines.USE_RTE = 1;
  }
  if (state.useMsdf) {
    shader.defines.USE_MSDF = 1;
  }

  // Assign uniform refs to shader.uniforms via mutates
  mutates.updateUniforms(shader.uniforms, state);
};
