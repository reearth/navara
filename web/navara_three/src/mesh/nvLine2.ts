import type { LngLat } from "@navara/core";
import {
  Line2,
  LineGeometry,
  LineMaterial,
  LineSegmentsGeometry,
} from "three-stdlib";

export type LineConfig = {
  color: number;
  lineWidth: number;
  dashed: boolean;
  dashSize: number;
  gapSize: number;
  dashOffset: number;
  opacity: number;
  transparent: boolean;
  depthTest: boolean;
  depthWrite: boolean;
  geometry: LngLat[];
  height: number;
};

export const DefaultLineConfig: LineConfig = {
  color: 0xffffff,
  lineWidth: 1,
  dashed: false,
  dashSize: 1,
  gapSize: 1,
  dashOffset: 0,
  opacity: 1,
  transparent: false,
  depthTest: true,
  depthWrite: true,
  geometry: [],
  height: 0,
};

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
}

export class NvLine2 extends Line2 {
  private resizeEventUnsubscribe?: () => void;
  private readonly _config: LineConfig;

  constructor(config: Partial<LineConfig> = {}) {
    const fullConfig = { ...DefaultLineConfig, ...config };
    super(new NvLineGeometry(), new LineMaterial());

    this._config = fullConfig;
  }

  get lineWidth(): number {
    return this._config.lineWidth;
  }

  set lineWidth(value: number) {
    this._config.lineWidth = value;
    this.material.linewidth = value;
  }

  dispose(): void {
    this.resizeEventUnsubscribe?.();
    this.resizeEventUnsubscribe = undefined;
  }
}
