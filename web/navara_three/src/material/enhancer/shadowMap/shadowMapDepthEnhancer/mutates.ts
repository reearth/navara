import type { ShadowMapDepthMutates } from "./types";

export const createShadowMapDepthMutates = (): ShadowMapDepthMutates => {
  return {
    update: () => {},
    updateUniforms: (_uniforms) => {},
  };
};
