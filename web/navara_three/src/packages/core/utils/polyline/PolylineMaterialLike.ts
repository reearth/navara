import type {
  PolylineInternalMaterial,
  PolylineMaterial,
} from "@navara/engine";

export class PolylineMaterialLike implements PolylineMaterial {
  clamp_to_ground?: boolean;
  color: number;
  height?: number;
  width?: number;
  show?: boolean;
  __internal__?: PolylineInternalMaterial;

  constructor(material: PolylineMaterial) {
    this.clamp_to_ground = material.clamp_to_ground;
    this.color = material.color;
    this.width = material.width;
    this.height = material.height;
    this.show = material.show;
  }

  free(): void {}
}
