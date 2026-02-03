import WaterParsFragment from "@shaders/glsl/chunks/water_pars_fragment.glsl?raw";
import type { WebGLProgramParametersWithUniforms } from "three";

import {
  MODEL_BASE_SHADER_MARKERS,
  createModelBaseShaderReplacer,
} from "../modelBaseEnhancer/markers";

import type { ModelWaterMutates, ModelWaterState } from "./types";

/**
 * Transform shader with water-specific modifications.
 * Uniform assignment is handled by mutates.updateUniforms().
 */
export const transformWaterShader = (
  shader: WebGLProgramParametersWithUniforms,
  state: ModelWaterState,
  mutates: ModelWaterMutates,
): void => {
  const { useWater } = state;

  // Derive shader defines from semantic state flags
  shader.defines ??= {};
  if (useWater) {
    shader.defines.WATER = 1;
    if (state.skyEnvMap) {
      shader.defines.USE_SKY_ENVMAP = "1";
    }
  } else {
    delete shader.defines.WATER;
  }

  // Assign water uniform refs to shader.uniforms via mutates
  mutates.updateUniforms(shader.uniforms, state);

  // Insert WaterParsFragment before the computeSpecular function (non-marker-based)
  const computeSpecularMarker = "vec3 computeSpecular(";
  const specularIdx = shader.fragmentShader.indexOf(computeSpecularMarker);
  if (specularIdx !== -1) {
    const beforeSpecular = shader.fragmentShader.substring(0, specularIdx);
    const afterSpecular = shader.fragmentShader.substring(specularIdx);
    shader.fragmentShader =
      beforeSpecular + WaterParsFragment + "\n\n" + afterSpecular;
  }

  shader.fragmentShader = createModelBaseShaderReplacer(shader.fragmentShader)
    // Add water uniform declarations after base's UNIFORM_END
    .insertAfter(
      MODEL_BASE_SHADER_MARKERS.fragment.UNIFORM_END,
      `uniform sampler2D uWaterNormalMap;
uniform samplerCube tSkyEnvMap;
uniform float uWaterScaleNormal;
uniform float uWaterSpeed;
uniform float uShininess;
uniform float uSpecularStrength;
uniform float uApplyWaterNormal;
uniform bool uSpecular;
uniform float uIor;
uniform float uTime;
// uniform float reflectivity;`,
    )
    // Replace normal block with water/non-water specular computation
    .replaceBlock(
      {
        start: MODEL_BASE_SHADER_MARKERS.fragment.NORMAL_START,
        end: MODEL_BASE_SHADER_MARKERS.fragment.NORMAL_END,
      },
      `vec3 origNormal = normal;
vec3 specular;

#ifdef WATER
  specular = computeWaterSpecularSimple(
    uWaterNormalMap,
    vPosition.xy * uWaterScaleNormal,
    uTime * uWaterSpeed,
    vViewPosition,
    uShininess,
    uSpecularStrength,
    diffuseColor.rgb,
    normal
  );
#else
  if(uSpecular) {
    specular = computeSpecular(
      vViewPosition,
      origNormal,
      uShininess,
      uSpecularStrength,
      uIor
    );
  }
  #include <normal_fragment_maps>
#endif`,
    )
    // Replace outgoing light block with env map + specular
    .insertAfter(
      MODEL_BASE_SHADER_MARKERS.fragment.OUTGOING_LIGHT_END,
      `#if defined(WATER) && defined(USE_SKY_ENVMAP)
  vec3 envColor = getSkyEnv(geometryNormal, tSkyEnvMap, vPosition);
  outgoingLight += envColor * reflectivity;
#endif
outgoingLight += specular;`,
    )
    // Replace final normal block with water normal mixing
    .replaceBlock(
      {
        start: MODEL_BASE_SHADER_MARKERS.fragment.FINAL_NORMAL_START,
        end: MODEL_BASE_SHADER_MARKERS.fragment.FINAL_NORMAL_END,
      },
      `vec3 finalNormal = mix(origNormal, normalize(origNormal * 0.7 + normal), uApplyWaterNormal);`,
    ).source;
};
