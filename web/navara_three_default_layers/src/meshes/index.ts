export {
  RainMeshDesc,
  type RainMeshConfig,
  type RainMeshUpdate,
} from "./RainMeshDesc";
export {
  SnowMeshDesc,
  type SnowMeshConfig,
  type SnowMeshUpdate,
} from "./SnowMeshDesc";
export {
  SkyMeshDesc,
  type SkyMeshConfig,
  type SkyMeshUpdate,
} from "./SkyMeshDesc";
export {
  StarsDesc,
  type StarsConfig,
  type StarsUpdate,
} from "./StarsDesc";
export {
  BoxMeshDesc,
  type BoxMeshConfig,
  type BoxMeshUpdate,
} from "./BoxMeshDesc";
export {
  SphereMeshDesc,
  type SphereMeshConfig,
  type SphereMeshUpdate,
} from "./SphereMeshDesc";
export {
  GlowGlobeMeshDesc,
  type GlowGlobeMeshConfig,
  type GlowGlobeMeshUpdate,
  DEFAULT_GLOW_GLOBE_OPTIONS,
} from "./GlowGlobeMeshDesc";
export {
  CylinderMeshDesc,
  type CylinderMeshConfig,
  type CylinderMeshUpdate,
} from "./CylinderMeshDesc";
export {
  PlaneMeshDesc,
  type PlaneMeshConfig,
  type PlaneMeshUpdate,
} from "./PlaneMeshDesc";
export {
  GLTFModelDesc,
  type GLTFModelConfig,
  type GLTFModelUpdate,
  type AnimationDetails,
  type AnimationState,
  type GLTFModelEvent,
  DEFAULT_GLTF_MODEL_DESCRIPTION,
} from "./GLTFModelDesc";
export {
  TubeMeshDesc,
  type TubeMeshConfig,
  type TubeMeshUpdate,
} from "./TubeMeshDesc";
export {
  ArclineMeshDesc,
  type ArclineMeshConfig,
  type ArclineMeshUpdate,
} from "./ArclineMeshDesc";
export {
  SmoothLineMeshDesc,
  type SmoothLineMeshConfig,
  type SmoothLineMeshUpdate,
} from "./SmoothLineMeshDesc";
export {
  SkyBoxMeshDesc,
  type SkyBoxMeshConfig,
  type SkyBoxMeshUpdate,
  DEFAULT_SKY_BOX_OPTIONS,
} from "./SkyBoxMeshDesc";
export {
  ArrowHelperDesc,
  type ArrowHelperConfig,
  type ArrowHelperUpdate,
} from "./ArrowHelperDesc";
export {
  AxesHelperDesc,
  type AxesHelperConfig,
  type AxesHelperUpdate,
} from "./AxesHelperDesc";
export {
  InstancedBoxMeshDesc,
  type InstancedBoxMeshConfig,
  type InstancedBoxMeshUpdate,
  type BoxChildConfig,
  type SharedBoxMaterialConfig,
  type BoxesDescription,
} from "./InstancedBoxMeshDesc";

// Mesh implementations
export { SkyMesh, type SkyMeshOptions } from "./skyMesh";
export { RainMesh, type RainConfig, DefaultRainConfig } from "./rain";
export { SnowMesh, type SnowConfig, DefaultSnowConfig } from "./snow";
export { Stars, type StarsOptions, DEFAULT_STARS_OPTIONS } from "./stars";
export { ArcLine, type ArcLineConfig, DefaultArcLineConfig } from "./arcLine";
export {
  SmoothLine,
  type SmoothLineConfig,
  DefaultSmoothLineConfig,
} from "./smoothLine";
export { SpherePoints, type SpherePointOptions } from "./spherePoints";
