import type {
  PolylineInternalMaterial,
  PolylineMaterial,
} from "@navara/engine";

export class PolylineMaterialLike {
  clamp_to_ground?: boolean;
  use_ground_normals?: boolean;
  cast_shadow?: boolean;
  receive_shadow?: boolean;
  color?: number;
  height?: number;
  width?: number;
  show?: boolean;
  __internal__?: PolylineInternalMaterial;

  constructor(material: PolylineMaterial) {
    this.clamp_to_ground = material.clamp_to_ground;
    this.use_ground_normals = material.use_ground_normals;
    this.receive_shadow = material.receive_shadow;
    this.cast_shadow = material.cast_shadow;
    this.color = material.color;
    this.width = material.width;
    this.height = material.height;
    this.show = material.show;
  }

  free(): void {}
}
