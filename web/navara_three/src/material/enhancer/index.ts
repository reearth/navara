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
export type { ShadowMapDepthProps } from "./shadowMap";

// Polyline enhancers
export { createPolylineMaterialEnhancer } from "./polyline";
export type {
  PolylineMaterialProps,
  PolylineBaseMutates,
  PolylineBaseProps,
  PolylineBaseState,
} from "./polyline";
