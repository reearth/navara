import type { Material, WebGLProgramParametersWithUniforms } from "three";
import {
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshPhongMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  ShaderLib,
} from "three";
import { beforeAll, describe, expect, it } from "vitest";

import { overrideMaterialsForMRT } from "../../overrideMaterialsForMRT";
import type { MaterialEnhancer, ShaderName } from "../MaterialEnhancer";
import type { ShaderMarkers } from "../ShaderReplacer";

type InferProps<E> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  E extends MaterialEnhancer<any, infer P, any, any, any> ? P : never;

const SHADER_MATERIAL_MAP: Record<ShaderName, new () => Material> = {
  basic: MeshBasicMaterial,
  lambert: MeshLambertMaterial,
  phong: MeshPhongMaterial,
  standard: MeshStandardMaterial,
  physical: MeshPhysicalMaterial,
};

const ALL_SHADER_TYPES = Object.keys(SHADER_MATERIAL_MAP) as ShaderName[];

function createMockShader(
  shaderType: ShaderName,
): WebGLProgramParametersWithUniforms {
  const shaderDef = ShaderLib[shaderType];
  return {
    vertexShader: shaderDef.vertexShader,
    fragmentShader: shaderDef.fragmentShader,
    uniforms: { ...shaderDef.uniforms },
    defines: {},
  } as WebGLProgramParametersWithUniforms;
}

/**
 * Test helper to verify that an enhancer correctly works with its declared shaders.
 *
 * This function creates a test suite that:
 * 1. Tests that all declared shaders and props pairs in availableShaders work without throwing
 * 2. Documents which shaders are intentionally unsupported
 * 3. Verifies all markers exist in their respective transformed shaders
 *
 * @param enhancerName - Name of the enhancer for test description
 * @param createEnhancer - Factory function that takes a material and returns an enhancer
 * @param propsTests - Test cases with props that trigger different shader paths
 * @param markers - Marker constants to verify in the transformed shaders
 */
export function testShaderCompatibility<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  E extends MaterialEnhancer<Material, any, any, any, ShaderName[]>,
>(
  enhancerName: string,
  createEnhancer: (material: Material) => E,
  propsTests: {
    name: string;
    props: InferProps<E>;
  }[],
  markers: ShaderMarkers,
): void {
  describe(`${enhancerName} - ShaderLib Compatibility`, () => {
    beforeAll(() => {
      overrideMaterialsForMRT();
    });

    describe("supported shaders", () => {
      describe.each(ALL_SHADER_TYPES)(
        "should transform %s shader without errors",
        (shaderType) => {
          const testMaterial = new SHADER_MATERIAL_MAP[shaderType]();
          const testEnhancer = createEnhancer(testMaterial);

          if (!testEnhancer.availableShaders.includes(shaderType)) return;

          it.each(propsTests)("$name", ({ props }) => {
            const mockShader = createMockShader(shaderType);

            // Mount
            testEnhancer.mount(props);
            const mountShader = structuredClone(mockShader);
            expect(() => {
              testEnhancer.transformShader(mountShader);
            }).not.toThrow();

            // Update
            testEnhancer.update(props);
            const updateShader = structuredClone(mockShader);
            expect(() => {
              testEnhancer.transformShader(updateShader);
            }).not.toThrow();

            // Verify markers exist in transformed shaders
            for (const markerValue of Object.values(markers.vertex)) {
              expect(updateShader.vertexShader).toContain(markerValue);
            }
            for (const markerValue of Object.values(markers.fragment)) {
              expect(updateShader.fragmentShader).toContain(markerValue);
            }
          });
        },
      );
    });
  });
}
