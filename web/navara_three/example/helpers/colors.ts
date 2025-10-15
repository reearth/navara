import { ColorMap } from "@navara/three";

// Ref: https://github.com/eukarya-inc/PLATEAU-VIEW/blob/26c98fa36e6cfe5776c04d1d2cbf77cc69eb264d/extension/src/prototypes/color-maps/colorMaps/plateau.ts
export const PLATEAU_COLOR_MAP = new ColorMap("sequential", "Plateau", [
  [76 / 255, 57 / 255, 105 / 255], // #4c3969
  [100 / 255, 61 / 255, 157 / 255], // #643d9d
  [122 / 255, 61 / 255, 212 / 255], // #7a3dd4
  [156 / 255, 89 / 255, 223 / 255], // #9c59df
  [189 / 255, 123 / 255, 222 / 255], // #bd7bde
  [208 / 255, 150 / 255, 191 / 255], // #d096bf
  [212 / 255, 173 / 255, 138 / 255], // #d4ad8a
  [217 / 255, 191 / 255, 108 / 255], // #d9bf6c
  [233 / 255, 204 / 255, 121 / 255], // #e9cc79
  [246 / 255, 218 / 255, 128 / 255], // #f6da80
  [248 / 255, 235 / 255, 106 / 255], // #f8eb6a
  [248 / 255, 252 / 255, 78 / 255], // #f8fc4e
]);

export default PLATEAU_COLOR_MAP;
