import {
  EdgeDetectionMode as PostProcessingEdgeDetectionMode,
  FXAAEffect,
  SMAAEffect,
  SMAAPreset,
} from "postprocessing";

import type { Quality } from "./quality";

export type EdgeDetectionMode = "color" | "depth";

export type Antialias = {
  enabled: boolean;
  effect?: "fxaa" | "smaa";
  quality?: Quality;
  // Using `color` might blur a texture, but `depth` has no effect on a mesh that has no depth.
  edgeDetectionMode?: EdgeDetectionMode;
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
      return new SMAAEffect({
        edgeDetectionMode:
          aa.edgeDetectionMode === "depth"
            ? PostProcessingEdgeDetectionMode.DEPTH
            : PostProcessingEdgeDetectionMode.COLOR,
        preset: selectSMAAPreset(aa.quality),
      });
  }
};

const selectSMAAPreset = (quality: Quality | undefined) => {
  if (!quality) return SMAAPreset.MEDIUM;
  switch (quality) {
    case "low":
      return SMAAPreset.LOW;
    case "medium":
      return SMAAPreset.MEDIUM;
    case "high":
      return SMAAPreset.HIGH;
    case "ultra":
      return SMAAPreset.ULTRA;
  }
};
