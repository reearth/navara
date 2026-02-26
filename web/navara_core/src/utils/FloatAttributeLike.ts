import type { FloatAttribute } from "@navara/engine";

import type { RemoveFreeRecursively } from "../types";

export class FloatAttributeLike
  implements RemoveFreeRecursively<FloatAttribute>
{
  data: Float32Array;
  size: number;

  constructor(t: FloatAttribute) {
    this.data = t.transferData();
    this.size = t.size;
  }

  transferData(): Float32Array {
    throw new Error();
  }
}
