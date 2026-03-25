import type { ShaderMarkers } from "../../ShaderReplacer";
import { createShaderReplacer } from "../../ShaderReplacer";

/**
 * Shader markers for the sdfText base enhancer.
 * These markers are placed in the shader code to allow composing enhancers to inject their own code.
 */
export const SDF_TEXT_BASE_SHADER_MARKERS = {
  vertex: {},
  fragment: {},
} as const satisfies ShaderMarkers;

/**
 * Factory function to create a ShaderReplacer restricted to sdfText base markers.
 * Used by composing enhancers to safely modify shaders.
 */
export function createSdfTextBaseShaderReplacer(source: string) {
  return createShaderReplacer<typeof SDF_TEXT_BASE_SHADER_MARKERS>(source);
}
