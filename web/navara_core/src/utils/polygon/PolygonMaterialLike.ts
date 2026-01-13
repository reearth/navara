import type { PolygonInternalMaterial, PolygonMaterial } from "@navara/engine";

export class PolygonMaterialLike {
  clampToGround?: boolean;
  useGroundNormals?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  color?: number;
  extrudedHeight?: number;
  height?: number;
  show?: boolean;
  perPositionHeight?: boolean;
  wireframe?: boolean;
  __internal__?: PolygonInternalMaterial | undefined;
  /** IDs of selective effects to apply (e.g., "bloom", "outline") */
  effectIds?: string[];
  /** Depth behavior for selective effect mask passes: "normal" or "silhouette" */
  selectiveEffectOcclusion?: string;
  /** Emissive glow color in 0xRRGGBB format */
  emissiveColor?: number;
  /** Emissive glow intensity (default: 0.3 when Bloom enabled) */
  emissiveIntensity?: number;

  constructor(material: PolygonMaterial) {
    this.clampToGround = material.clampToGround;
    this.useGroundNormals = material.useGroundNormals;
    this.receiveShadow = material.receiveShadow;
    this.castShadow = material.castShadow;
    this.color = material.color;
    this.extrudedHeight = material.extrudedHeight;
    this.height = material.height;
    this.show = material.show;

    this.perPositionHeight = material.perPositionHeight;

    this.wireframe = material.wireframe;

    this.effectIds = material.effectIds;
    this.selectiveEffectOcclusion = material.selectiveEffectOcclusion;
    this.emissiveColor = material.emissiveColor;
    this.emissiveIntensity = material.emissiveIntensity;
  }

  free(): void {}
}
