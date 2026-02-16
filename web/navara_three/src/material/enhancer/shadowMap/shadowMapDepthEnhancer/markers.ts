import { type ShaderMarkers, createShaderReplacer } from "../../ShaderReplacer";

export const SHADOW_MAP_DEPTH_SHADER_MARKERS = {
  vertex: {},
  fragment: {},
} as const satisfies ShaderMarkers;

export function createShadowMapDepthShaderReplacer(source: string) {
  return createShaderReplacer<typeof SHADOW_MAP_DEPTH_SHADER_MARKERS>(source);
}
