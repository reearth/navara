export { Registry } from "./Registry";
export { Registries } from "./Registries";
export * from "./layerErrors";
export {
  Declaration,
  type DeclarationConfig,
  type DeclarationConfigUpdate,
} from "./Declaration";
export {
  MeshDeclaration,
  type MeshUpdate,
  type MeshConfig,
  type PassKey,
} from "./MeshDeclaration";
export {
  MeshDeclarationForSelectiveEffect,
  type MeshUpdateWithSelectiveEffect,
  type MeshConfigWithSelectiveEffect,
} from "./MeshDeclarationForSelectiveEffect";
export {
  InstancedMeshDeclaration,
  type InstancedMeshConfig,
  type InstancedMeshUpdate,
  type InstancedChildConfig,
} from "./InstancedMeshDeclaration";
export {
  MeshRegistry,
  type MeshConstructor,
} from "./MeshRegistry";
export {
  LightDeclaration,
  type LightUpdate,
  type LightConfig,
} from "./LightDeclaration";
export {
  LightRegistry,
  type LightConstructor,
} from "./LightRegistry";
export {
  EffectDeclaration,
  type EffectUpdate,
  type EffectConfig,
} from "./EffectDeclaration";
export {
  EffectRegistry,
  type EffectConstructor,
} from "./EffectRegistry";
export { Handle } from "./Handle";
export * from "./ViewContext";
export {
  // Helper class
  SelectiveEffectHelper,
  // Types
  type SelectiveEffectOptions,
  type SelectiveEffectResources,
  type SelectiveEffectConfig,
  type SelectiveEffectOcclusion,
  type SelectiveEffectOcclusionValue,
  // Constants
  SELECTIVE_BLOOM_EFFECT_KEY,
  SELECTIVE_OUTLINE_EFFECT_KEY,
  SelectiveEffectOcclusionMode,
  // Common helpers
  resolveSelectiveEffectOcclusion,
  hasSelectiveBloomEffect,
  hasSelectiveOutlineEffect,
  getSelectiveEffectConfig,
  hasSelectiveEffectConfig,
  ensureSelectiveEffectUserData,
  parseSelectiveEffectOcclusion,
  // Utility functions
  createDepthClipMaterial,
  createFullscreenQuad,
  applyDepthClip,
} from "./SelectiveEffectHelper";
export { SelectiveEffectManager } from "./SelectiveEffectManager";
export { SelectiveEffectMaskController } from "./SelectiveEffectMaskController";
export {
  // Types
  type MaskPassPhaseType,
  type MaskPassContext,
  type MaskPassEvaluation,
  type SelectiveEffectHandlerOptions,
  // Constants
  MaskPassPhase,
  // Context management
  getMaskPassContext,
  setMaskPassContext,
  resetMaskPassContext,
  // Helper functions
  evaluateMaskPassParticipation,
  applyMaskPassSkipState,
  applyMaskPassRenderState,
  restoreMaterialState,
  // Unified handler injection
  injectSelectiveEffectHandlers,
} from "./SelectiveEffectMaskContext";
