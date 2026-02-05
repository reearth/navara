import type { PntsMutates, PntsRefs } from "./types";

/**
 * Default refs with initial values.
 */
const DEFAULT_PNTS_REFS: PntsRefs = {
  uAddHeight: { value: 0 },
  uGeodeticNormal: { value: [0, 0, 0] },
};

/**
 * Create mutation functions for the PNTS enhancer.
 * Refs are created internally and captured via closure.
 */
export const createPntsMutates = (): PntsMutates => {
  const refs = structuredClone(DEFAULT_PNTS_REFS) as PntsRefs;

  return {
    update: (state) => {
      refs.uAddHeight.value = state.height;
      const n = state.geodeticNormal;
      refs.uGeodeticNormal.value = [n.x, n.y, n.z];
    },
    updateUniforms: (uniforms) => {
      uniforms.uAddHeight = refs.uAddHeight;
      uniforms.uGeodeticNormal = refs.uGeodeticNormal;
    },
  };
};
