// Animation utility functions

import type { AnimationState } from "../types";

/**
 * Calculate crossfade weights between two animation states
 */
export function getCrossfadeWeights(
  from: AnimationState,
  to: AnimationState,
  t: number,
): { idle: number; walk: number; run: number } {
  const w = { idle: 0, walk: 0, run: 0 };
  const vFrom = Math.max(0, 1 - t);
  const vTo = Math.max(0, t);

  // Set weights only for animations involved in the transition
  if (from === "Idle") w.idle = vFrom;
  if (from === "Walk") w.walk = vFrom;
  if (from === "Run") w.run = vFrom;
  if (to === "Idle") w.idle = vTo;
  if (to === "Walk") w.walk = vTo;
  if (to === "Run") w.run = vTo;

  // Explicitly set weights to 0 for unrelated animations
  if (
    (from === "Walk" && to === "Idle") ||
    (from === "Idle" && to === "Walk")
  ) {
    w.run = 0; // Set run to 0 during walk ↔ idle transitions
  }

  if ((from === "Walk" && to === "Run") || (from === "Run" && to === "Walk")) {
    w.idle = 0; // Set idle to 0 during walk ↔ run transitions
  }

  // Set walk to 0 for idle ↔ run transitions (for future extensions)
  if ((from === "Idle" && to === "Run") || (from === "Run" && to === "Idle")) {
    w.walk = 0;
  }

  return w;
}

/**
 * Get current primary animation state based on weights
 */
export function getCurrentPrimaryAnimation(weights: {
  idle: number;
  walk: number;
  run: number;
}): AnimationState | null {
  // Find the animation with the highest weight
  let maxWeight = 0;
  let primaryAnimation: AnimationState | null = null;

  if (weights.idle > maxWeight) {
    maxWeight = weights.idle;
    primaryAnimation = "Idle";
  }
  if (weights.walk > maxWeight) {
    maxWeight = weights.walk;
    primaryAnimation = "Walk";
  }
  if (weights.run > maxWeight) {
    maxWeight = weights.run;
    primaryAnimation = "Run";
  }

  // Only return primary animation if it has significant weight (> 0.5)
  return maxWeight > 0.5 ? primaryAnimation : null;
}
