import { type ShaderMarkers, createShaderReplacer } from "../../ShaderReplacer";

export const MODEL_BASE_SHADER_MARKERS = {
  vertex: {},
  fragment: {
    /** Start of model uniform declarations. */
    UNIFORM_START: "// NVR_MODEL_BASE_UNIFORM_START",
    /** End of model uniform declarations. */
    UNIFORM_END: "// NVR_MODEL_BASE_UNIFORM_END",
    /** Start of normal computation block. */
    NORMAL_START: "// NVR_MODEL_BASE_NORMAL_START",
    /** End of normal computation block. */
    NORMAL_END: "// NVR_MODEL_BASE_NORMAL_END",
    /** Start of outgoing light additions block. */
    OUTGOING_LIGHT_START: "// NVR_MODEL_BASE_OUTGOING_LIGHT_START",
    /** End of outgoing light additions block. */
    OUTGOING_LIGHT_END: "// NVR_MODEL_BASE_OUTGOING_LIGHT_END",
    /** Start of the final normal assignment block (used for MRT output). */
    FINAL_NORMAL_START: "// NVR_MODEL_BASE_FINAL_NORMAL_START",
    /** End of the final normal assignment block (used for MRT output). */
    FINAL_NORMAL_END: "// NVR_MODEL_BASE_FINAL_NORMAL_END",
  },
} as const satisfies ShaderMarkers;

export function createModelBaseShaderReplacer(source: string) {
  return createShaderReplacer<typeof MODEL_BASE_SHADER_MARKERS>(source);
}
