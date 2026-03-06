export { ShaderLib } from "./MaterialEnhancer";
export type {
  EnhancedMaterial,
  MaterialEnhancer,
  MaterialsFromShaders,
  Mutates,
  ShaderName,
} from "./MaterialEnhancer";

// Polygon enhancers
export { createPolygonMaterialEnhancer } from "./polygon";
export type { PolygonMaterialProps } from "./polygon";

// Shadow map depth enhancers
export { createShadowMapDepthEnhancer } from "./shadowMap";
export type {
  ShadowMapDepthProps,
  ShadowMapDepthSupportedMaterial,
} from "./shadowMap";

// Polyline enhancers
export { createPolylineMaterialEnhancer } from "./polyline";
export type {
  PolylineMaterialProps,
  PolylineBaseMutates,
  PolylineBaseProps,
  PolylineBaseState,
} from "./polyline";

// InstancedSprite enhancers
export { createInstancedSpriteMaterialEnhancer } from "./instancedSprite";
export type { InstancedSpriteMaterialProps } from "./instancedSprite";
export type {
  InstancedSpriteBaseMutates,
  InstancedSpriteBaseProps,
  InstancedSpriteBaseState,
} from "./instancedSprite";
