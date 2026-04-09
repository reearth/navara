import type { MeshLambertMaterial, MeshStandardMaterial } from "three";

const SE_SETUP_FLAG = Symbol("SE_SETUP");

/**
 * Set up Selective Effect defines and effectIdsMask uniform on a standard Three.js material.
 * Sets USE_SELECTIVE_EFFECT define so the MRT shader writes effectIds + emissive.
 * Emissive values use Three.js built-in material.emissive / material.emissiveIntensity.
 * Used by non-enhancer meshes (Box, Sphere, etc.).
 *
 * Idempotent — calling multiple times on the same material is safe (no-op after first call).
 */
export function setupSelectiveEffectUniforms(
  material: MeshLambertMaterial | MeshStandardMaterial,
): void {
  // Guard: only set up once per material
  if ((material as unknown as Record<symbol, boolean>)[SE_SETUP_FLAG]) return;
  (material as unknown as Record<symbol, boolean>)[SE_SETUP_FLAG] = true;

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
    prevOnBeforeCompile?.call(material, shader, renderer);

    // Link effectIdsMask uniform for runtime value updates
    shader.uniforms.uEffectIdsMask = material.userData.uEffectIdsMask;
  };
}
