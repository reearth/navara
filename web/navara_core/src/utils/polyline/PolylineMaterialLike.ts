import type {
  PolylineInternalMaterial,
  PolylineMaterial,
} from "@navara/engine";

export class PolylineMaterialLike {
  clampToGround?: boolean;
  useGroundNormals?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  color?: number;
  height?: number;
  width?: number;
  show?: boolean;
  __internal__?: PolylineInternalMaterial;
  /** IDs of selective effects to apply (e.g., "bloom", "outline") */
  effectIds?: string[];
  /** Depth behavior for selective effect mask passes: "normal" or "silhouette" */
  selectiveEffectOcclusion?: string;
  /** Emissive glow color in 0xRRGGBB format */
  emissiveColor?: number;
  /** Emissive glow intensity (default: 0.3 when Bloom enabled) */
  emissiveIntensity?: number;

  constructor(material: PolylineMaterial) {
    this.clampToGround = material.clampToGround;
    this.useGroundNormals = material.useGroundNormals;
    this.receiveShadow = material.receiveShadow;
    this.castShadow = material.castShadow;
    this.color = material.color;
    this.width = material.width;
    this.height = material.height;
    this.show = material.show;

    this.effectIds = material.effectIds;
    this.selectiveEffectOcclusion = material.selectiveEffectOcclusion;
    this.emissiveColor = material.emissiveColor;
    this.emissiveIntensity = material.emissiveIntensity;
  }

  free(): void {}
}
