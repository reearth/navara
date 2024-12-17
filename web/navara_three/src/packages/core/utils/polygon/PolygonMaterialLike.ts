import type { PolygonMaterial } from "@navara/engine";

export class PolygonMaterialLike implements PolygonMaterial {
  clamp_to_ground?: boolean;
  color: number;
  extruded_height?: number;
  height?: number;
  show?: boolean;
  wireframe?: boolean;

  constructor(material: PolygonMaterial) {
    this.clamp_to_ground = material.clamp_to_ground;
    this.color = material.color;
    this.extruded_height = material.extruded_height;
    this.height = material.height;
    this.show = material.show;
    this.wireframe = material.wireframe;
  }

  free(): void {}
}
