import {
  Color as ThreeColor,
  type ColorRepresentation,
  type MeshLambertMaterial,
  type MeshStandardMaterial,
} from "three";

/**
 * Set up emissive buffer uniforms on a standard Three.js material.
 * Injects uEmissiveOnly/uEmissiveColor/uEmissiveIntensity via onBeforeCompile.
 * Used by non-enhancer meshes (Box, Sphere, etc.) for EmissiveBufferPass support.
 */
export function setupEmissiveBufferUniforms(
  material: MeshLambertMaterial | MeshStandardMaterial,
  emissiveColor: ColorRepresentation,
  emissiveIntensity: number,
): void {
  material.userData.uEmissiveOnly = { value: 0 };
  material.userData.uEmissiveColor = { value: new ThreeColor(emissiveColor) };
  material.userData.uEmissiveIntensity = { value: emissiveIntensity };

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uEmissiveOnly = material.userData.uEmissiveOnly;
    shader.uniforms.uEmissiveColor = material.userData.uEmissiveColor;
    shader.uniforms.uEmissiveIntensity = material.userData.uEmissiveIntensity;

    // uEmissiveOnly is already declared by overrideMaterialsForMRT.
    // Add uEmissiveColor/uEmissiveIntensity declarations and override the
    // default vec4(0.0) early-return with emissive color output.
    shader.fragmentShader =
      `uniform vec3 uEmissiveColor;\nuniform float uEmissiveIntensity;\n` +
      shader.fragmentShader.replace(
        /if \(uEmissiveOnly > 0\.5\) \{[^}]*\}/,
        `if (uEmissiveOnly > 0.5) { gl_FragColor = vec4(uEmissiveColor, uEmissiveIntensity); return; }`,
      );
  };
}

/**
 * Sync emissive buffer uniforms when material properties change.
 * Call this in onUpdateConfig after updating material.emissive / material.emissiveIntensity.
 */
export function syncEmissiveBufferUniforms(
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
