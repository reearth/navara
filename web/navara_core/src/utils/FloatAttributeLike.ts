import type { FloatAttribute } from "@navara/engine";

export class FloatAttributeLike implements FloatAttribute {
  data: Float32Array;
  size: number;

  constructor(t: FloatAttribute) {
    this.data = t.transferData();
    this.size = t.size;
  }

  transferData(): Float32Array {
    throw new Error();
  }

  free(): void {}
}
