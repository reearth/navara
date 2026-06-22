export const watermaskGlobalUniformDecls = (): string =>
  `uniform sampler2D uWatermask;`;

/**
 * Sampled once after the slot loop and OR'd into isWater so it takes priority
 * even when no per-slot water flag fired (e.g. open-ocean tiles with no
 * raster/vector layers).
 */
export const watermaskPostLoop = (): string => `
  // Quantized-mesh watermask: 0 = land, 255 = water (per spec). Takes priority
  // over per-slot uWaters — even if no winning slot flagged water, watermask
  // can still mark this pixel as water. Threshold at 0.5 (byte > 127).
  isWater = max(isWater, step(0.5, texture(uWatermask, vUv).r));`;
