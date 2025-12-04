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
  }

  free(): void {}
}
