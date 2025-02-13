import {
  EdgeDetectionMode,
  FXAAEffect,
  SMAAEffect,
  SMAAPreset,
} from "postprocessing";

import type { Quality } from "./quality";

export type Antialias = {
  enabled: boolean;
  effect?: "fxaa" | "smaa";
  quality?: Quality;
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
        edgeDetectionMode: EdgeDetectionMode.DEPTH,
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
