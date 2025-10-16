import type { PolygonInternalMaterial, PolygonMaterial } from "@navara/engine";

export class PolygonMaterialLike {
  clamp_to_ground?: boolean;
  use_ground_normals?: boolean;
  cast_shadow?: boolean;
  receive_shadow?: boolean;
  color?: number;
  extruded_height?: number;
  height?: number;
  show?: boolean;
  per_position_height?: boolean;
  wireframe?: boolean;
  __internal__?: PolygonInternalMaterial | undefined;

  constructor(material: PolygonMaterial) {
    this.clamp_to_ground = material.clamp_to_ground;
    this.use_ground_normals = material.use_ground_normals;
    this.receive_shadow = material.receive_shadow;
    this.cast_shadow = material.cast_shadow;
    this.color = material.color;
    this.extruded_height = material.extruded_height;
    this.height = material.height;
    this.show = material.show;

    this.per_position_height = material.per_position_height;

    this.wireframe = material.wireframe;
  }

  free(): void {}
}
