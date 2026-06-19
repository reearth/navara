import { Uniform, type Texture } from "three";

import type { CompositeGlobals } from "../../../../tileTexture/types";
import type { CompositeUniformTarget } from "../tileCompositeBaseEnhancer";

export type WatermaskMutates = {
  attachUniforms: (
    target: CompositeUniformTarget,
    numTextures: number,
    placeholder: Texture,
  ) => void;
  bindGlobal: (globals: CompositeGlobals) => void;
};

/** Owns the slot-independent watermask sampler. */
export function createWatermaskMutates(): WatermaskMutates {
  const refs = { uWatermask: new Uniform<Texture | null>(null) };
  let placeholderTexture: Texture | null = null;
  return {
    attachUniforms: (target, _numTextures, placeholder) => {
      // Initialised to the 1×1 placeholder (byte 0 → no water) so the sampler
      // is valid before the first bindGlobal.
      placeholderTexture = placeholder;
      refs.uWatermask.value = placeholder;
      target.uWatermask = refs.uWatermask;
    },
    bindGlobal: (globals) => {
      // No watermask on this tile → fall back to the placeholder so the sampler
      // stays valid (R=0 → step(0.5, 0)=0 → no water) and a stale texture from a
      // prior tile on this shared material doesn't leak through.
      refs.uWatermask.value = globals.watermask ?? placeholderTexture;
    },
  };
}
