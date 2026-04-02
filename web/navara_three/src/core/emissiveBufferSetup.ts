import {
  Color as ThreeColor,
  type ColorRepresentation,
  type MeshLambertMaterial,
  type MeshStandardMaterial,
} from "three";

/**
 * Set up Selective Effect buffer uniforms on a standard Three.js material.
 * Injects uSelectiveEffectBufferMode/uEmissiveColor/uEmissiveIntensity/uEffectIdsMask via onBeforeCompile.
 * Used by non-enhancer meshes (Box, Sphere, etc.) for SelectiveEffectBufferPass support.
 */
export function setupSelectiveEffectBufferUniforms(
  material: MeshLambertMaterial | MeshStandardMaterial,
  emissiveColor: ColorRepresentation,
  emissiveIntensity: number,
): void {
  material.userData.uSelectiveEffectBufferMode = { value: 0 };
  material.userData.uEmissiveColor = { value: new ThreeColor(emissiveColor) };
  material.userData.uEmissiveIntensity = { value: emissiveIntensity };
  material.userData.uEffectIdsMask = { value: 0 };

  const prevOnBeforeCompile = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    // Chain previous onBeforeCompile if it exists
    prevOnBeforeCompile.call(material, shader, renderer);

    shader.uniforms.uSelectiveEffectBufferMode =
      material.userData.uSelectiveEffectBufferMode;
    shader.uniforms.uEmissiveColor = material.userData.uEmissiveColor;
    shader.uniforms.uEmissiveIntensity = material.userData.uEmissiveIntensity;
    shader.uniforms.uEffectIdsMask = material.userData.uEffectIdsMask;

    // uSelectiveEffectBufferMode and uEffectIdsMask are already declared by overrideMaterialsForMRT.
    // Add uEmissiveColor/uEmissiveIntensity declarations and override the
    // default vec4(0.0) early-return with emissive color output.
    shader.fragmentShader =
      `uniform vec3 uEmissiveColor;\nuniform float uEmissiveIntensity;\n` +
      shader.fragmentShader.replace(
        /if \(uSelectiveEffectBufferMode > 0\.5\) \{[^}]*\}/,
        `if (uSelectiveEffectBufferMode > 0.5) { gl_FragColor = vec4(uEmissiveColor, uEmissiveIntensity); outputBuffer1 = vec4(uEffectIdsMask, 0.0, 0.0, 1.0); return; }`,
      );
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
