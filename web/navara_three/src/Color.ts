import { Color as CoreColor } from "@navara/core";
import { NoColorSpace, SRGBColorSpace, Color as ThreeColor } from "three";

/**
 * Class representing a color.
 * This class assumes that the specified color represents the sRGB color space.
 *
 * ```
 * const red = new Color().setRGB(1.0, 0.0, 0.0);
 * const green = new Color().setHex(0x00ff00);
 * const blue = new Color().setStyle("#0000ff");
 * ```
 */
export class Color implements CoreColor {
  #color = new ThreeColor();

  /**
   * Sets RGB. The range is: 0.0 ~ 1.0
   */
  setRGB(r: number, g: number, b: number) {
    this.#color.setRGB(r, g, b, SRGBColorSpace);
    return this;
  }

  setRGBLinear(r: number, g: number, b: number) {
    this.#color.setRGB(r, g, b, NoColorSpace);
    return this;
  }

  /**
   * Sets hex color: 0xffffff
   */
  setHex(hex: number) {
    this.#color.setHex(hex, SRGBColorSpace);
    return this;
  }

  /**
   * Sets this color from a CSS context style string.
   */
  setStyle(style: string) {
    this.#color.setStyle(style, SRGBColorSpace);
    return this;
  }

  copy(color: Color) {
    color.#color = this.#color.clone();
    return color as this;
  }

  clone() {
    return this.copy(new Color());
  }

  toArray(): [r: number, g: number, b: number] {
    return this.#color.toArray() as [r: number, g: number, b: number];
  }

  srgb() {
    const copy = new Color();
    copy.#color = new ThreeColor().copyLinearToSRGB(this.#color);
    return copy as this;
  }

  get raw() {
    return this.#color;
  }
}
