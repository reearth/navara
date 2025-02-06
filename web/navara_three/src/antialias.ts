import { EdgeDetectionMode, FXAAEffect, SMAAEffect } from "postprocessing";

export type Antialias = {
  enabled: boolean;
  effect?: "fxaa" | "smaa";
};

export const DEFAULT_ANTIALIAS: Antialias = {
  enabled: true,
  effect: "smaa",
};

export const selectAntialiasEffect = (aa: Antialias | undefined) => {
  if (!aa?.enabled) {
    return;
  }
  const effect = aa.effect ?? DEFAULT_ANTIALIAS.effect;
  switch (effect) {
    case "fxaa":
      return new FXAAEffect();
    case "smaa":
      // Anti-alias just to the depth to avoid blurring a texture.
      return new SMAAEffect({ edgeDetectionMode: EdgeDetectionMode.DEPTH });
  }
};
