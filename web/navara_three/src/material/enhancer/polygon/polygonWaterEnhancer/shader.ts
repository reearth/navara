import WaterParsFragment from "@shaders/glsl/chunks/water_pars_fragment.glsl?raw";
import type { WebGLProgramParametersWithUniforms } from "three";

import {
  POLYGON_BASE_SHADER_MARKERS,
  createPolygonBaseShaderReplacer,
} from "../polygonBaseEnhancer/markers";

import type { PolygonWaterState, WaterMutates } from "./types";

/**
 * Transform shader with water-specific modifications.
 * Uniform assignment is handled by mutates.updateUniforms().
 */
export const transformWaterShader = (
  shader: WebGLProgramParametersWithUniforms,
  state: PolygonWaterState,
  mutates: WaterMutates,
): void => {
  const { useWater } = state;

  // Derive shader defines from semantic state flags
  shader.defines ??= {};
  if (useWater) {
    shader.defines.WATER = 1;
    shader.defines.USE_UV = 1;
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

  shader.fragmentShader = createPolygonBaseShaderReplacer(shader.fragmentShader)
    // Add water uniform declarations after base's UNIFORM_END
    .insertAfter(
      POLYGON_BASE_SHADER_MARKERS.fragment.UNIFORM_END,
      `uniform sampler2D uWaterNormalMap;
uniform float uWaterScaleNormal;
uniform float uWaterSpeed;
uniform float uShininess;
uniform float uSpecularStrength;
uniform float uApplyWaterNormal;
uniform bool uSpecular;
uniform float uIor;
uniform float uTime;`,
    )
    // Insert specular computation after base's NORMAL_END
    .insertAfter(
      POLYGON_BASE_SHADER_MARKERS.fragment.NORMAL_END,
      useWater
        ? `
if(!uIsTexturized) {
  specular = computeWaterSpecular(
    uWaterNormalMap,
    (vPosition.xy + vPosition.zy + vPosition.xz) / 3.0 * uWaterScaleNormal,
    uTime * uWaterSpeed,
    vViewPosition,
    normalMatrix,
    origNormal,
    uShininess,
    uSpecularStrength,
    diffuseColor.rgb,
    normal
  );
}`
        : `
if(uSpecular && !uIsTexturized) {
  specular = computeSpecular(
    vViewPosition,
    origNormal,
    uShininess,
    uSpecularStrength,
    uIor
  );
}`,
    )
    // Replace final normal block with water version
    .replaceBlock(
      {
        start: POLYGON_BASE_SHADER_MARKERS.fragment.FINAL_NORMAL_START,
        end: POLYGON_BASE_SHADER_MARKERS.fragment.FINAL_NORMAL_END,
      },
      `vec3 finalNormal = mix(origNormal, normalize(origNormal * 0.7 + normal), uApplyWaterNormal);`,
    ).source;
};
