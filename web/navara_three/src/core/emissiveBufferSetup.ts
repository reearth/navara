import {
  Color as ThreeColor,
  type ColorRepresentation,
  type MeshLambertMaterial,
  type MeshStandardMaterial,
} from "three";

/**
 * Set up Selective Effect uniforms on a standard Three.js material.
 * Sets USE_SELECTIVE_EFFECT define on material.defines (not just shader.defines)
 * and links uEmissiveColor/uEmissiveIntensity/uEffectIdsMask via onBeforeCompile.
 * Used by non-enhancer meshes (Box, Sphere, etc.).
 */
export function setupSelectiveEffectBufferUniforms(
  material: MeshLambertMaterial | MeshStandardMaterial,
  emissiveColor: ColorRepresentation,
  emissiveIntensity: number,
): void {
  material.userData.uEmissiveColor = { value: new ThreeColor(emissiveColor) };
  material.userData.uEmissiveIntensity = { value: emissiveIntensity };
  material.userData.uEffectIdsMask = { value: 0 };

  // Set define on material.defines so Three.js includes it in program cache key.
  // This ensures SE and non-SE materials get separate compiled programs.
  material.defines = material.defines ?? {};
  material.defines.USE_SELECTIVE_EFFECT = 1;

  // Include SE token in program cache key to prevent SE/non-SE program sharing
  const prevCacheKey = material.customProgramCacheKey;
  material.customProgramCacheKey = () => {
    const base = prevCacheKey ? prevCacheKey.call(material) : "";
    return `${base}_SE`;
  };

  const prevOnBeforeCompile = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    // Chain previous onBeforeCompile if it exists
    prevOnBeforeCompile.call(material, shader, renderer);

    // Link userData refs to shader uniforms for runtime value updates
    shader.uniforms.uEmissiveColor = material.userData.uEmissiveColor;
    shader.uniforms.uEmissiveIntensity = material.userData.uEmissiveIntensity;
    shader.uniforms.uEffectIdsMask = material.userData.uEffectIdsMask;
  };
}

/**
 * Sync Selective Effect buffer custom uniforms when emissive config changes.
 */
export function syncSelectiveEffectBufferUniforms(
  material: MeshLambertMaterial | MeshStandardMaterial,
  emissiveColor?: ColorRepresentation,
  emissiveIntensity?: number,
): void {
  if (emissiveColor !== undefined && material.userData.uEmissiveColor) {
    const colorValue = material.userData.uEmissiveColor.value;
    if (colorValue instanceof ThreeColor) {
      colorValue.set(emissiveColor);
    }
  }
  if (emissiveIntensity !== undefined && material.userData.uEmissiveIntensity) {
    material.userData.uEmissiveIntensity.value = emissiveIntensity;
  }
}
