import { BaseAbstractedVec3 } from "@navara/core";
import { Vector3 } from "three";

export class ThreeVec3 extends BaseAbstractedVec3 {
  /**
   * @private
   */
  _raw: Vector3;

  constructor(x: number, y: number, z: number) {
    super(x, y, z);
    this._raw = new Vector3(x, y, z);
  }

  static fromRaw(v: Vector3) {
    return new ThreeVec3(...v.toArray());
  }

  copy(x: number, y: number, z: number): void {
    super.copy(x, y, z);
    this._raw.copy({ x, y, z });
  }
}
