// Type definitions for GLTF Animation example

export type AnimationState = "Idle" | "Walk" | "Run";

export type AnimationWeights = {
  readonly name: AnimationState;
  readonly weight: number;
};

export type AnimationControlParams = {
  showModel: boolean;
  showSkeleton: boolean;
  useDefaultDuration: boolean;
  customDuration: number;
  idleWeight: number;
  walkWeight: number;
  runWeight: number;
  timeScale: number;
};

export type BlendWeightApis = {
  idleWeight: { refresh: () => void };
  walkWeight: { refresh: () => void };
  runWeight: { refresh: () => void };
};

export type AnimationControlReturn = {
  applyWeights: (weights: readonly AnimationWeights[]) => void;
  setDefaultWeights: (weights: readonly AnimationWeights[]) => void;
};
