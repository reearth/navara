import { Uniform } from "three";

import type { CompositeLayer } from "../../../../tileTexture/types";
import type { CompositeUniformTarget } from "../tileCompositeBaseEnhancer";

export type WaterMutates = {
  attachUniforms: (target: CompositeUniformTarget, numTextures: number) => void;
  bindSlot: (compactSlot: number, layer: CompositeLayer | undefined) => void;
};

/** Owns the per-slot water flag array. */
export function createWaterMutates(): WaterMutates {
  const refs = { uWaters: new Uniform<boolean[]>([]) };
  return {
    attachUniforms: (target, numTextures) => {
      refs.uWaters.value = new Array<boolean>(numTextures).fill(false);
      target.uWaters = refs.uWaters;
    },
    bindSlot: (k, layer) => {
      refs.uWaters.value[k] = layer?.kind === "raster" ? layer.water : false;
    },
  };
}
