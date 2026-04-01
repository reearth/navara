import { type MeshLambertMaterial, type MeshStandardMaterial } from "three";

/**
 * Set up EffectIds buffer uniforms on a standard Three.js material.
 * Injects uEffectIdsMode/uEffectIdsMask via onBeforeCompile.
 * Used by non-enhancer meshes (Box, Sphere, etc.) for EffectIdsBufferPass support.
 */
export function setupEffectIdsBufferUniforms(
  material: MeshLambertMaterial | MeshStandardMaterial,
): void {
  material.userData.uEffectIdsMode = { value: 0 };
  material.userData.uEffectIdsMask = { value: 0 };

  const prevOnBeforeCompile = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prevOnBeforeCompile.call(material, shader, renderer);
    shader.uniforms.uEffectIdsMode = material.userData.uEffectIdsMode;
    shader.uniforms.uEffectIdsMask = material.userData.uEffectIdsMask;
  };
}
