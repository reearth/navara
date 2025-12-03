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

  constructor(material: PolylineMaterial) {
    this.clampToGround = material.clampToGround;
    this.useGroundNormals = material.useGroundNormals;
    this.receiveShadow = material.receiveShadow;
    this.castShadow = material.castShadow;
    this.color = material.color;
    this.width = material.width;
    this.height = material.height;
    this.show = material.show;
  }

  free(): void {}
}
