export { DescRegistry } from "./DescRegistry";
export { Registries } from "./Registries";
export * from "./errors";
export {
  BaseDesc,
  type BaseDescConfig,
  type BaseDescConfigUpdate,
} from "./BaseDesc";
export {
  MeshDesc,
  type MeshUpdate,
  type MeshConfig,
  type PassKey,
} from "./MeshDesc";
export {
  MeshDescWithSelectiveEffect,
  type MeshUpdateWithSelectiveEffect,
  type MeshConfigWithSelectiveEffect,
} from "./MeshDescWithSelectiveEffect";
export {
  InstancedMeshDesc,
  type InstancedMeshConfig,
  type InstancedMeshUpdate,
  type InstancedChildConfig,
} from "./InstancedMeshDesc";
export {
  MeshDescBase,
  type MeshDescBaseConfig,
  type MeshDescBaseUpdate,
  type MeshDescBaseInstance,
} from "./MeshDescBase";
export {
  NewMeshDesc,
  type MeshDescConfig,
  type MeshDescUpdate,
} from "./NewMeshDesc";
export {
  NewInstancedMeshDesc,
  type NewInstancedMeshConfig,
  type NewInstancedMeshUpdate,
  type NewInstancedChildConfig,
  type InstancedMeshDescConfig,
  type InstancedMeshDescUpdate,
  type InstancedMeshDescChildConfig,
} from "./NewInstancedMeshDesc";
export {
  MeshDescRegistry,
  type MeshDescConstructor,
  type AnyMeshConfig,
} from "./MeshDescRegistry";
export { type AnyMeshDesc } from "./BaseHandle";
export { LightDesc, type LightUpdate, type LightConfig } from "./LightDesc";
export {
  LightDescRegistry,
  type LightDescConstructor,
} from "./LightDescRegistry";
export { EffectDesc, type EffectUpdate, type EffectConfig } from "./EffectDesc";
export {
  EffectDescRegistry,
  type EffectDescConstructor,
} from "./EffectDescRegistry";
export {
  BaseHandle,
  MeshHandle,
  LightHandle,
  EffectHandle,
} from "./BaseHandle";
export * from "./ViewContext";
export { SelectiveEffectRegistry } from "./SelectiveEffectRegistry";
export { setupSelectiveEffectUniforms } from "../material/selectiveEffectMaterialSetup";
