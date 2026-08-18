import {
  Box3,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  Sphere,
  Vector3,
} from "three";
import { LineGeometry, LineSegmentsGeometry } from "three-stdlib";

export class NvLineGeometry extends LineGeometry {
  setPositions(
    array: Float32Array,
    skipIdx: Uint32Array = new Uint32Array(),
  ): this {
    const positions: number[] = [];
    const skipSet = new Set(skipIdx);

    for (let i = 0; i < array.length - 3; i += 3) {
      const currentIndex = i / 3;
      if (skipSet.has(currentIndex)) {
        continue;
      }

      // segment start
      positions.push(array[i], array[i + 1], array[i + 2]);
      // segment end
      positions.push(array[i + 3], array[i + 4], array[i + 5]);
    }

    const points = new Float32Array(positions);

    // This function is used to override LineGeometry's setPositions,
    // so we don't call super.setPositions.
    LineSegmentsGeometry.prototype.setPositions.call(this, points);
    return this;
  }

  /**
   * Attach RTE high/low positions as per-segment instanced attributes.
   *
   * Mirrors the segment expansion (and skip handling) of `setPositions` and
   * the interleaved layout of `LineSegmentsGeometry.setPositions`
   * (stride 6: start xyz at offset 0, end xyz at offset 3). The RTE shader
   * reads only these attributes, so callers skip `setPositions` entirely —
   * no unused `instanceStart`/`instanceEnd` buffer is uploaded to the GPU.
   * Because `LineSegmentsGeometry.computeBoundingBox/Sphere` read
   * `instanceStart`/`instanceEnd`, the bounds are computed here instead,
   * from the reconstructed absolute (high + low) positions.
   */
  setPositionsHighLow(
    high: Float32Array,
    low: Float32Array,
    skipIdx: Uint32Array = new Uint32Array(),
  ): this {
    const highSegments: number[] = [];
    const lowSegments: number[] = [];
    const skipSet = new Set(skipIdx);

    const box = new Box3();
    const point = new Vector3();

    for (let i = 0; i < high.length - 3; i += 3) {
      const currentIndex = i / 3;
      if (skipSet.has(currentIndex)) {
        continue;
      }

      // segment start + end
      highSegments.push(
        high[i],
        high[i + 1],
        high[i + 2],
        high[i + 3],
        high[i + 4],
        high[i + 5],
      );
      lowSegments.push(
        low[i],
        low[i + 1],
        low[i + 2],
        low[i + 3],
        low[i + 4],
        low[i + 5],
      );

      box.expandByPoint(
        point.set(
          high[i] + low[i],
          high[i + 1] + low[i + 1],
          high[i + 2] + low[i + 2],
        ),
      );
      box.expandByPoint(
        point.set(
          high[i + 3] + low[i + 3],
          high[i + 4] + low[i + 4],
          high[i + 5] + low[i + 5],
        ),
      );
    }

    const highBuffer = new InstancedInterleavedBuffer(
      new Float32Array(highSegments),
      6,
      1,
    );
    const lowBuffer = new InstancedInterleavedBuffer(
      new Float32Array(lowSegments),
      6,
      1,
    );
    this.setAttribute(
      "instanceStartHigh",
      new InterleavedBufferAttribute(highBuffer, 3, 0),
    );
    this.setAttribute(
      "instanceEndHigh",
      new InterleavedBufferAttribute(highBuffer, 3, 3),
    );
    this.setAttribute(
      "instanceStartLow",
      new InterleavedBufferAttribute(lowBuffer, 3, 0),
    );
    this.setAttribute(
      "instanceEndLow",
      new InterleavedBufferAttribute(lowBuffer, 3, 3),
    );

    // Exact-radius sphere (same behavior as LineSegmentsGeometry's own
    // computeBoundingSphere, which cannot run without instanceStart/End).
    this.boundingBox = box;
    const sphere = this.boundingSphere ?? new Sphere();
    const center = box.getCenter(sphere.center);
    let maxRadiusSq = 0;
    for (let i = 0; i < highSegments.length; i += 3) {
      point.set(
        highSegments[i] + lowSegments[i],
        highSegments[i + 1] + lowSegments[i + 1],
        highSegments[i + 2] + lowSegments[i + 2],
      );
      maxRadiusSq = Math.max(maxRadiusSq, center.distanceToSquared(point));
    }
    sphere.radius = Math.sqrt(maxRadiusSq);
    this.boundingSphere = sphere;

    return this;
  }
}
