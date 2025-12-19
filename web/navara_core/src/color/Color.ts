export abstract class Color {
  abstract setRGB(r: number, g: number, b: number): this;
  abstract setHex(hex: number): this;
  abstract setStyle(style: string): this;
  abstract copy(color: this): this;
  abstract clone(): this;
  abstract srgb(): this;
  abstract toArray(): [r: number, g: number, b: number];
  abstract toHex(): number;
}
