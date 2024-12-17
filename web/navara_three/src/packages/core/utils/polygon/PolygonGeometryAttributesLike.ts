import type { FloatAttribute, PolygonGeometryAttributes } from "@navara/engine";

import { FloatAttributeLike } from "../FloatAttributeLike";

export class PolygonGeometryAttributesLike
  implements PolygonGeometryAttributes
{
  batch_id?: FloatAttributeLike;
  normal?: FloatAttributeLike;
  position: FloatAttributeLike;
  scale_normal_and_cap?: FloatAttributeLike;

  constructor(t: PolygonGeometryAttributes) {
    const batchId = t.transferBatchId();
    const normal = t.transferNormal();
    const position = t.transferPosition();
    const scaleNormalAndCap = t.transferScaleNormalAndCap();

    this.batch_id = batchId ? new FloatAttributeLike(batchId) : undefined;
    this.normal = normal ? new FloatAttributeLike(normal) : undefined;
    this.position = new FloatAttributeLike(position);
    this.scale_normal_and_cap = scaleNormalAndCap
      ? new FloatAttributeLike(scaleNormalAndCap)
      : undefined;
  }

  transferPosition(): FloatAttribute {
    throw new Error();
  }
  transferNormal(): FloatAttribute | undefined {
    throw new Error();
  }
  transferScaleNormalAndCap(): FloatAttribute | undefined {
    throw new Error();
  }
  transferBatchId(): FloatAttribute | undefined {
    throw new Error();
  }

  free(): void {}
}
