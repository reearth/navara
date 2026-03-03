import type { ShaderMarkers } from "../../ShaderReplacer";
import { createShaderReplacer } from "../../ShaderReplacer";

/**
 * Shader markers for the instancedSprite base enhancer.
 * These markers are placed in the shader code to allow composing enhancers to inject their own code.
 */
export const INSTANCED_SPRITE_BASE_SHADER_MARKERS = {
  vertex: {},
  fragment: {},
} as const satisfies ShaderMarkers;

/**
 * Factory function to create a ShaderReplacer restricted to instancedSprite base markers.
 * Used by composing enhancers to safely modify shaders.
 */
export function createInstancedSpriteBaseShaderReplacer(source: string) {
  return createShaderReplacer<typeof INSTANCED_SPRITE_BASE_SHADER_MARKERS>(
    source,
  );
}
