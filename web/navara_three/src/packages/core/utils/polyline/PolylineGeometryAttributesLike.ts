import type {
  FloatAttribute,
  PolylineGeometryAttributes,
} from "@navara/engine";

import { FloatAttributeLike } from "../FloatAttributeLike";

export class PolylineGeometryAttributesLike
  implements PolylineGeometryAttributes
{
  position: FloatAttribute;
  start: FloatAttribute;
  start_normals: FloatAttribute;
  forward_offset: FloatAttribute;
  end_normal_and_texture_coordinate_normalization_x: FloatAttribute;
  right_normal_and_texture_coordinate_normalization_y: FloatAttribute;
  batch_id?: FloatAttribute;

  constructor(t: PolylineGeometryAttributes) {
    const batchId = t.transferBatchId();
    const position = t.transferPosition();
    const start = t.transferStart();
    const startNormals = t.transferStartNormals();
    const forwardOffset = t.transferForwardOffset();
    const endNormalAndTextureCoordinateNormalizationX =
      t.transferEndNormalAndTextureCoordinateNormalizationX();
    const rightNormalAndTextureCoordinateNormalizationY =
      t.transferRightNormalAndTextureCoordinateNormalizationY();

    this.position = new FloatAttributeLike(position);
    this.start = new FloatAttributeLike(start);
    this.start_normals = new FloatAttributeLike(startNormals);
    this.forward_offset = new FloatAttributeLike(forwardOffset);
    this.end_normal_and_texture_coordinate_normalization_x =
      new FloatAttributeLike(endNormalAndTextureCoordinateNormalizationX);
    this.right_normal_and_texture_coordinate_normalization_y =
      new FloatAttributeLike(rightNormalAndTextureCoordinateNormalizationY);
    this.batch_id = batchId ? new FloatAttributeLike(batchId) : undefined;
  }

  transferPosition(): FloatAttribute {
    throw new Error();
  }
  transferStart(): FloatAttribute {
    throw new Error();
  }
  transferStartNormals(): FloatAttribute {
    throw new Error();
  }
  transferForwardOffset(): FloatAttribute {
    throw new Error();
  }
  transferEndNormalAndTextureCoordinateNormalizationX(): FloatAttribute {
    throw new Error();
  }
  transferRightNormalAndTextureCoordinateNormalizationY(): FloatAttribute {
    throw new Error();
  }
  transferBatchId(): FloatAttribute | undefined {
    throw new Error();
  }

  free(): void {}
}
