import { FXAAEffect, SMAAEffect } from "postprocessing";

export type Antialias = {
  enabled: boolean;
  effect: "fxaa" | "smaa";
};

export const DEFAULT_ANTIALIAS: Antialias = {
  enabled: true,
  effect: "fxaa",
};

export const selectAntialiasEffect = (aa: Antialias | undefined) => {
  if (!aa?.enabled) {
    return;
  }
  switch (aa.effect) {
    case "fxaa":
      return new FXAAEffect();
    case "smaa":
      return new SMAAEffect();
  }
};
