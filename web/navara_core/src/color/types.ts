import type { Color } from "./Color";

export type ColorTuple = [number, number, number];
export type LUT = readonly (ColorTuple | Color)[];
