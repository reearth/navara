// Effect implementations (moved from @navara/three)
export * from "./aa";
export * from "./aerialPerspective";
export * from "./clouds/index";
export * from "./colorGradingLUT";
export * from "./depthOfField";
export * from "./fogLight";
export * from "./lensFlare";
export * from "./rainDropEffect";
export * from "./ssao";
export * from "./ssr";
export * from "./toneMapping";

// Effect layer declarations
export {
  AerialPerspectiveEffectDeclaration,
  type AerialPerspectiveConfig,
  type AerialPerspectiveUpdate,
} from "./AerialPerspectiveEffectDeclaration";
export {
  CloudsEffectDeclaration,
  type CloudsConfig,
  type CloudsUpdate,
} from "./CloudsEffectDeclaration";
export {
  ColorGradingLUTEffectDeclaration,
  DEFAULT_COLOR_GRADING_LUT_OPTIONS,
  type ColorGradingLUTConfig,
  type ColorGradingLUTUpdate,
} from "./ColorGradingLUTEffectDeclaration";
export {
  DepthOfFieldEffectDeclaration,
  type DepthOfFieldConfig,
  type DepthOfFieldUpdate,
} from "./DepthOfFieldEffectDeclaration";
export {
  FogLightEffectDeclaration,
  type FogLightConfig,
  type FogLightUpdate,
} from "./FogLightEffectDeclaration";
export {
  FXAAEffectDeclaration,
  type FXAAConfig,
  type FXAAUpdate,
} from "./FXAAEffectDeclaration";
export {
  LensFlareEffectDeclaration,
  type LensFlareConfig,
  type LensFlareUpdate,
} from "./LensFlareEffectDeclaration";
export {
  RainDropEffectDeclaration,
  type RainDropConfig,
  type RainDropUpdate,
} from "./RainDropEffectDeclaration";
export {
  SMAAEffectDeclaration,
  type SMAAConfig,
  type SMAAUpdate,
} from "./SMAAEffectDeclaration";
export {
  SSAOEffectDeclaration,
  type SSAOConfig,
  type SSAOUpdate,
} from "./SSAOEffectDeclaration";
export {
  SSREffectDeclaration,
  type SSRConfig,
  type SSRUpdate,
} from "./SSREffectDeclaration";
export {
  ToneMappingEffectDeclaration,
  type ToneMappingConfig,
  type ToneMappingUpdate,
} from "./ToneMappingEffectDeclaration";

export { ToneMappingMode } from "postprocessing";
