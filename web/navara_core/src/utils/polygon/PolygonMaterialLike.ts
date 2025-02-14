import type { PolygonInternalMaterial, PolygonMaterial } from "@navara/engine";

export class PolygonMaterialLike implements PolygonMaterial {
  clamp_to_ground?: boolean;
  use_ground_normals?: boolean;
  color?: number;
  extruded_height?: number;
  height?: number;
  show?: boolean;
  wireframe?: boolean;
  __internal__?: PolygonInternalMaterial | undefined;

  constructor(material: PolygonMaterial) {
    this.clamp_to_ground = material.clamp_to_ground;
    this.use_ground_normals = material.use_ground_normals;
    this.color = material.color;
    this.extruded_height = material.extruded_height;
    this.height = material.height;
    this.show = material.show;
    this.wireframe = material.wireframe;
  }

  free(): void {}
}
