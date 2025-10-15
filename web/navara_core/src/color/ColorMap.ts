import { interpolate, quantize, rgb, scaleLinear, type ScaleLinear } from "d3";
import invariant from "tiny-invariant";

import { type ColorTuple, type LUT } from "./types";

export type ColorMapType = "sequential" | "diverging";

// TODO: Handle the color calculation in Rust by https://github.com/Ogeon/palette.
// Ref: https://github.com/eukarya-inc/PLATEAU-VIEW/blob/26c98fa36e6cfe5776c04d1d2cbf77cc69eb264d/extension/src/prototypes/color-maps/ColorMap.ts
export class ColorMap<T extends ColorMapType = ColorMapType> {
  constructor(
    readonly type: T,
    readonly name: string,
    readonly lut: LUT,
  ) {
    invariant(lut.length > 1);
  }

  #linear?: ScaleLinear<ColorTuple, ColorTuple> | undefined;
  linear(value: number): ColorTuple {
    this.buildLinear();
    invariant(this.#linear);

    const result = this.#linear(value);
    invariant(result != null);
    return result;
  }

  buildLinear() {
    if (this.#linear != null) {
      return;
    }
    this.#linear = scaleLinear<ColorTuple>()
      .domain(quantize(interpolate(0, 1), this.lut.length))
      .range(this.lut)
      .clamp(true);
  }

  get count(): number {
    return this.lut.length;
  }

  ticks(range: [min: number, max: number], count: number) {
    return scaleLinear<ColorTuple>().domain(range).ticks(count);
  }

  quantize(count: number): ColorTuple[] {
    invariant(count > 1);
    return [...Array(count)].map((_, index) => {
      return this.linear(index / (count - 1));
    });
  }

  createImage(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = this.lut.length;
    canvas.height = 1;
    const context = canvas.getContext("2d");
    invariant(context != null);
    this.lut.forEach(([r, g, b], index) => {
      context.fillStyle = rgb(r * 255, g * 255, b * 255).toString();
      context.fillRect(index, 0, 1, 1);
    });
    return canvas;
  }
}
