import ElevationParsFragment from "@shaders/glsl/chunks/elevation_pars_fragment.glsl";

import type { CompositeSlotContext } from "../tileCompositeBaseEnhancer";

export const elevationSlotUniformDecls = (numTextures: number): string =>
  `uniform bool uIsElevationHeatmaps[${numTextures}];`;

export const elevationIncludes = (): string => ElevationParsFragment;

/**
 * Replaces the per-slot sampler with a DEM-decode + colormap lookup; non-heatmap
 * slots fall back to the straight raster fetch in the else branch.
 */
export const elevationSampleProducer = ({
  k,
}: CompositeSlotContext): string => `
    vec4 texColor${k};
    if (uIsElevationHeatmaps[${k}]) {
      ivec2 demTexSize = textureSize(uTextures[${k}], 0);
      float normalized_h = sampleElevationBilinear(uTextures[${k}], texUv${k}, demTexSize);
      texColor${k} = vec4(texture2D(uColorMapTexture, vec2(normalized_h, 0.5)).rgb, 1.0);
    } else {
      texColor${k} = texture2D(uTextures[${k}], texUv${k}) * vec4(uColors[${k}], 1.0);
    }`;
