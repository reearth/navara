import type { ShaderMarkers } from "../../ShaderReplacer";
import { createShaderReplacer } from "../../ShaderReplacer";

/**
 * Shader markers for the polyline base enhancer.
 * These markers are placed in the shader code to allow composing enhancers to inject their own code.
 */
export const POLYLINE_BASE_SHADER_MARKERS = {
  vertex: {},
  fragment: {},
} as const satisfies ShaderMarkers;

/**
 * Factory function to create a ShaderReplacer restricted to polyline base markers.
 * Used by composing enhancers to safely modify shaders.
 */
export function createPolylineBaseShaderReplacer(source: string) {
  return createShaderReplacer<typeof POLYLINE_BASE_SHADER_MARKERS>(source);
}
