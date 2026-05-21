import { Fn, diffuseColor, emissive, uniform, vec4 } from "three/tsl";
import type { Node } from "three/webgpu";

export type SelectiveEffectNodes = {
  /** Wire this into {@link setupNodeMaterialForMRT}'s `effectIdNode`. */
  effectIdNode: Node<"vec4">;
  /** Wire this into {@link setupNodeMaterialForMRT}'s `emissiveNode`. */
  emissiveNode: Node<"vec4">;
  /** Update the effectId bitmask at runtime (e.g. when `effectIds` changes). */
  setEffectIdsMask(value: number): void;
  /** Update the emissive intensity at runtime. */
  setEmissiveIntensity(value: number): void;
};

/**
 * Selective-effect additive emissive: matches the GLSL formula
 * `vec4(diffuseColor.rgb * uEmissiveIntensity + emissive, 1.0)`.
 *
 * `diffuseColor` and `emissive` are TSL globals that resolve to the lit
 * material's per-fragment values, so this `Fn` only needs the per-material
 * intensity uniform as an explicit input.
 */
const selectiveEmissiveNode = Fn(([intensity]: [Node<"float">]) =>
  vec4(diffuseColor.rgb.mul(intensity).add(emissive), 1),
).setLayout({
  name: "selectiveEmissive",
  type: "vec4",
  inputs: [{ name: "intensity", type: "float" }],
});

/**
 * TSL counterpart of {@link setupSelectiveEffectUniforms}.
 *
 * Produces the nodes that should be wired into {@link setupNodeMaterialForMRT}
 * for the effectId / emissive MRT slots, plus runtime setters for updating
 * the underlying uniforms when configuration changes.
 *
 * The emissive output uses the same additive formula as the existing GLSL
 * path: `vec4(diffuseColor.rgb * uEmissiveIntensity + emissive, 1.0)`.
 *
 * Also installs `material.userData.uEffectIdsMask` / `uEmissiveIntensity` as
 * proxies that forward writes to the TSL uniforms, so the existing
 * `MeshDescWithSelectiveEffect.updateEffectIdsMask` flow (which writes to
 * `material.userData.uEffectIdsMask.value`) keeps working unchanged.
 */
export function setupNodeMaterialForSelectiveEffect(options: {
  emissiveIntensity: number;
}): SelectiveEffectNodes {
  const uEffectIdsMask = uniform(0);
  const uEmissiveIntensity = uniform(options.emissiveIntensity ?? 0);

  const setEffectIdsMask = (value: number) => {
    uEffectIdsMask.value = value;
  };
  const setEmissiveIntensity = (value: number) => {
    uEmissiveIntensity.value = value;
  };

  const effectIdNode = vec4(uEffectIdsMask, 0, 0, 1);
  const emissiveNode = selectiveEmissiveNode(uEmissiveIntensity);

  return {
    effectIdNode,
    emissiveNode,
    setEffectIdsMask,
    setEmissiveIntensity,
  };
}
