export { createInstancedSpriteMaterialEnhancer } from "./instancedSpriteMaterialEnhancer";
export type { InstancedSpriteMaterialProps } from "./instancedSpriteMaterialEnhancer";
export type {
  InstancedSpriteBaseMutates,
  InstancedSpriteBaseProps,
  InstancedSpriteBaseState,
} from "./instancedSpriteMaterialEnhancer";

// Point (TSL NodeMaterial) path
export {
  createInstancedSpritePointMaterialEnhancer,
  getInstancedPointNodeMaterial,
  instancedPointMaterialKey,
} from "./instancedSpritePointEnhancer";
export type {
  InstancedPointMaterialOptions,
  InstancedPointMaterialUniforms,
  InstancedPointNodeMaterial,
  InstancedSpritePointBaseProps,
  InstancedSpritePointBaseState,
  InstancedSpritePointEnhancer,
  InstancedSpritePointEnhancerOptions,
  InstancedSpritePointMaterialProps,
} from "./instancedSpritePointEnhancer";
