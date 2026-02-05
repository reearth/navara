import type { ShaderMarkers } from "../../ShaderReplacer";

export const PNTS_SHADER_MARKERS = {
  vertex: {},
  fragment: {},
} as const satisfies ShaderMarkers;
