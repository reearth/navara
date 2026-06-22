import { Uniform } from "three";

import type {
  CompositeGlobals,
  CompositeLayer,
} from "../../../../tileTexture/types";
import type { CompositeUniformTarget } from "../tileCompositeBaseEnhancer";

export type HillshadeMutates = {
  attachUniforms: (target: CompositeUniformTarget, numTextures: number) => void;
  bindSlot: (compactSlot: number, layer: CompositeLayer | undefined) => void;
  bindGlobal: (globals: CompositeGlobals) => void;
};

/** Owns the hillshade per-slot flag array + shared exaggeration uniform. */
export function createHillshadeMutates(): HillshadeMutates {
  const refs = {
    uIsHillshades: new Uniform<boolean[]>([]),
    uHillshadeExaggeration: new Uniform(1.0),
  };
  return {
    attachUniforms: (target, numTextures) => {
      refs.uIsHillshades.value = new Array<boolean>(numTextures).fill(false);
      target.uIsHillshades = refs.uIsHillshades;
      target.uHillshadeExaggeration = refs.uHillshadeExaggeration;
    },
    bindSlot: (k, layer) => {
      refs.uIsHillshades.value[k] = layer?.kind === "hillshade";
    },
    bindGlobal: (globals) => {
      refs.uHillshadeExaggeration.value = globals.hillshadeExaggeration;
    },
  };
}
