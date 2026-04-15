import type { MeshLambertMaterial, MeshStandardMaterial } from "three";

const SELECTIVE_EFFECT_SETUP = Symbol("SELECTIVE_EFFECT_SETUP");

/**
 * Set up Selective Effect defines and uniforms on a standard Three.js material.
 * Sets USE_SELECTIVE_EFFECT define so the MRT shader writes effectIds + emissive.
 * Emissive output uses additive blend: diffuseColor × emissiveIntensity + emissive.
 * Used by non-enhancer meshes (Box, Sphere, etc.).
 *
 * Idempotent — calling multiple times on the same material is safe (no-op after first call).
 */
export function setupSelectiveEffectUniforms(
  material: MeshLambertMaterial | MeshStandardMaterial,
): void {
  // Guard: only set up once per material
  if ((material as unknown as Record<symbol, boolean>)[SELECTIVE_EFFECT_SETUP])
    return;
  (material as unknown as Record<symbol, boolean>)[SELECTIVE_EFFECT_SETUP] =
    true;

  material.userData.uEffectIdsMask = { value: 0 };
  // Getter-based uniform: auto-syncs with material.emissiveIntensity without manual updates
  material.userData.uEmissiveIntensity = {
    get value() {
      return material.emissiveIntensity;
    },
  };

  // Set define on material.defines so Three.js includes it in program cache key.
  // This ensures SelectiveEffect and non-SelectiveEffect materials get separate compiled programs.
  material.defines = material.defines ?? {};
  material.defines.USE_SELECTIVE_EFFECT = 1;

  // Include SelectiveEffect token in program cache key to prevent program sharing
  const prevCacheKey = material.customProgramCacheKey;
  material.customProgramCacheKey = () => {
    const base = prevCacheKey ? prevCacheKey.call(material) : "";
    return `${base}_SelectiveEffect`;
  };

  const prevOnBeforeCompile = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prevOnBeforeCompile?.call(material, shader, renderer);

    // Link SelectiveEffect uniforms for runtime value updates
    shader.uniforms.uEffectIdsMask = material.userData.uEffectIdsMask;
    shader.uniforms.uEmissiveIntensity = material.userData.uEmissiveIntensity;
  };

  // Force recompile if the material was already rendered with the old program
  material.needsUpdate = true;
}
