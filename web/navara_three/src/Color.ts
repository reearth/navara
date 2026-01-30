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
   * Sets the color using RGB values in sRGB color space.
   * @param r - Red component (0.0 to 1.0)
   * @param g - Green component (0.0 to 1.0)
   * @param b - Blue component (0.0 to 1.0)
   * @returns This color instance for chaining
   */
  setRGB(r: number, g: number, b: number) {
    this.#color.setRGB(r, g, b, SRGBColorSpace);
    return this;
  }

  /**
   * Sets the color using RGB values in linear color space (no gamma correction).
   * @param r - Red component (0.0 to 1.0)
   * @param g - Green component (0.0 to 1.0)
   * @param b - Blue component (0.0 to 1.0)
   * @returns This color instance for chaining
   */
  setRGBLinear(r: number, g: number, b: number) {
    this.#color.setRGB(r, g, b, NoColorSpace);
    return this;
  }

  /**
   * Sets the color from a hexadecimal value in sRGB color space.
   * @param hex - Hexadecimal color value (e.g., 0xff0000 for red)
   * @returns This color instance for chaining
   */
  setHex(hex: number) {
    this.#color.setHex(hex, SRGBColorSpace);
    return this;
  }

  /**
   * Sets the color from a CSS style string in sRGB color space.
   * @param style - CSS color string (e.g., "#ff0000", "rgb(255, 0, 0)", "red")
   * @returns This color instance for chaining
   */
  setStyle(style: string) {
    this.#color.setStyle(style, SRGBColorSpace);
    return this;
  }

  /**
   * Copies this color's values to another Color instance.
   * @param color - Target color to copy values into
   * @returns The target color with copied values
   */
  copy(color: Color) {
    color.#color = this.#color.clone();
    return color as this;
  }

  /**
   * Creates a new Color instance with the same values.
   * @returns A new Color instance
   */
  clone() {
    return this.copy(new Color());
  }

  /**
   * Returns the color as an RGB array.
   * @returns Tuple of [red, green, blue] values (0.0 to 1.0)
   */
  toArray(): [r: number, g: number, b: number] {
    return this.#color.toArray() as [r: number, g: number, b: number];
  }

  /**
   * Converts the color from linear to sRGB color space.
   * @returns A new Color instance in sRGB color space
   */
  srgb() {
    const copy = new Color();
    copy.#color = new ThreeColor().copyLinearToSRGB(this.#color);
    return copy as this;
  }

  /**
   * Returns the color as a hexadecimal number.
   * @returns Hexadecimal color value (e.g., 0xff0000 for red)
   */
  toHex(): number {
    return this.#color.getHex();
  }

  /**
   * Gets the underlying Three.js Color instance.
   */
  get raw() {
    return this.#color;
  }
}
