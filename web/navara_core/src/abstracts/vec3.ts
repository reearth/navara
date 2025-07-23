import { Vec3 } from "@navara/engine";

export abstract class BaseAbstractedVec3 {
  value: Vec3;

  constructor(x: number, y: number, z: number) {
    this.value = new Vec3(x, y, z);
  }

  copy(x: number, y: number, z: number) {
    this.value.x = x;
    this.value.y = y;
    this.value.z = z;
  }
}
