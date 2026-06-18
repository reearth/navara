import type { CompositeSlotContext } from "../tileCompositeBaseEnhancer";

export const waterSlotUniformDecls = (numTextures: number): string =>
  `uniform bool uWaters[${numTextures}];`;

/** Flag the winning slot's pixel as water (attr.r). */
export const waterPerSlotOnWinner = ({ k }: CompositeSlotContext): string => `
      isWater = uWaters[${k}] ? 1.0 : 0.0;`;
