import { BlendFunction } from "postprocessing";
import type { Camera, Texture } from "three";

import { Effect, type EffectOptions } from "../effect";

import {
  SSREffect as SSREffectImpl,
  ssrEffectOptionsDefaults,
} from "./SSREffect";

export type SSROptions = {
  /** Texture containing geometry information (normals, depth) for reflection calculations */
  geometryBuffer?: Texture | null;
  /** Resolution scale factor for SSR rendering (0-1, lower values improve performance) */
  resolutionScale?: number;
  /** Maximum number of ray marching iterations for finding reflection intersections */
  iterations?: number;
  /** Number of binary search refinement steps to improve reflection accuracy */
  binarySearchIterations?: number;
  /** Depth buffer precision threshold for pixel rejection */
  pixelZSize?: number;
  /** Step size in pixels for ray marching along screen space */
  pixelStride?: number;
  /** Depth cutoff value for reducing pixel stride in distant areas */
  pixelStrideZCutoff?: number;
  /** Maximum distance a reflection ray can travel in world units */
  maxRayDistance?: number;
  /** Screen position (0-1) where edge fade begins to hide artifacts */
  screenEdgeFadeStart?: number;
  /** Start angle (radians) for fading reflections based on viewing angle */
  eyeFadeStart?: number;
  /** End angle (radians) for fading reflections based on viewing angle */
  eyeFadeEnd?: number;
  /** Amount of random jitter to reduce artifact */
  jitter?: number;
  /** Surface roughness factor affecting reflection clarity (0=mirror, 1=diffuse) */
  roughness?: number;
  /** Blend function for compositing reflections with the scene */
  blendFunction?: BlendFunction;
  kernelSize?: number;
  useConeTracing?: boolean;
  coneTracingFadeStart?: number;
  coneTracingFadeEnd?: number;
  coneTracingMaxDistance?: number;
  coneTracingIteration?: number;
} & EffectOptions;

export const DEFAULT_SSR_OPTIONS: Required<SSROptions> = {
  enabled: false,
  geometryBuffer: null,
  resolutionScale: 0.5,
  iterations: 100,
  binarySearchIterations: 4,
  pixelZSize: 100,
  pixelStride: 5,
  pixelStrideZCutoff: 500,
  maxRayDistance: 5000,
  screenEdgeFadeStart: 0.75,
  eyeFadeStart: 0,
  eyeFadeEnd: 1,
  jitter: 1,
  roughness: 0,
  blendFunction: BlendFunction.NORMAL,
  kernelSize: 5,
  useConeTracing: true,
  coneTracingFadeStart: ssrEffectOptionsDefaults.coneTracingFadeStart,
  coneTracingFadeEnd: ssrEffectOptionsDefaults.coneTracingFadeEnd,
  coneTracingMaxDistance: ssrEffectOptionsDefaults.coneTracingMaxDistance,
  coneTracingIteration: ssrEffectOptionsDefaults.coneTracingIteration,
};

export class SSR extends Effect<SSREffectImpl, SSROptions> {
  constructor(camera: Camera, _options: SSROptions = {}) {
    const options = { ...DEFAULT_SSR_OPTIONS, ..._options };
    const effect = new SSREffectImpl(camera, {
      geometryBuffer: options.geometryBuffer,
      resolutionScale: options.resolutionScale,
      iterations: options.iterations,
      binarySearchIterations: options.binarySearchIterations,
      pixelZSize: options.pixelZSize,
      pixelStride: options.pixelStride,
      pixelStrideZCutoff: options.pixelStrideZCutoff,
      maxRayDistance: options.maxRayDistance,
      screenEdgeFadeStart: options.screenEdgeFadeStart,
      eyeFadeStart: options.eyeFadeStart,
      eyeFadeEnd: options.eyeFadeEnd,
      jitter: options.jitter,
      roughness: options.roughness,
      blendFunction: options.blendFunction,
      kernelSize: options.kernelSize,
      useConeTracing: options.useConeTracing,
      coneTracingFadeStart: options.coneTracingFadeStart,
      coneTracingFadeEnd: options.coneTracingFadeEnd,
      coneTracingMaxDistance: options.coneTracingMaxDistance,
      coneTracingIteration: options.coneTracingIteration,
    });

    super(camera, effect, options);

    this.options = options;
    this.init();
  }

  init() {
    if (!this.rawEffect) return;

    // Set initial values from options - check for undefined
    if (this.options.resolutionScale !== undefined) {
      this.resolutionScale = this.options.resolutionScale;
    }
    if (this.options.iterations !== undefined) {
      this.iterations = this.options.iterations;
    }
    if (this.options.binarySearchIterations !== undefined) {
      this.binarySearchIterations = this.options.binarySearchIterations;
    }
    if (this.options.pixelZSize !== undefined) {
      this.pixelZSize = this.options.pixelZSize;
    }
    if (this.options.pixelStride !== undefined) {
      this.pixelStride = this.options.pixelStride;
    }
    if (this.options.pixelStrideZCutoff !== undefined) {
      this.pixelStrideZCutoff = this.options.pixelStrideZCutoff;
    }
    if (this.options.maxRayDistance !== undefined) {
      this.maxRayDistance = this.options.maxRayDistance;
    }
    if (this.options.screenEdgeFadeStart !== undefined) {
      this.screenEdgeFadeStart = this.options.screenEdgeFadeStart;
    }
    if (this.options.eyeFadeStart !== undefined) {
      this.eyeFadeStart = this.options.eyeFadeStart;
    }
    if (this.options.eyeFadeEnd !== undefined) {
      this.eyeFadeEnd = this.options.eyeFadeEnd;
    }
    if (this.options.jitter !== undefined) {
      this.jitter = this.options.jitter;
    }
    if (this.options.roughness !== undefined) {
      this.roughness = this.options.roughness;
    }
    if (this.options.useConeTracing !== undefined) {
      this.useConeTracing = this.options.useConeTracing;
    }
    if (this.options.coneTracingFadeStart !== undefined) {
      this.coneTracingFadeStart = this.options.coneTracingFadeStart;
    }
    if (this.options.coneTracingFadeEnd !== undefined) {
      this.coneTracingFadeEnd = this.options.coneTracingFadeEnd;
    }
    if (this.options.coneTracingMaxDistance !== undefined) {
      this.coneTracingMaxDistance = this.options.coneTracingMaxDistance;
    }
    if (this.options.coneTracingIteration !== undefined) {
      this.coneTracingIteration = this.options.coneTracingIteration;
    }
  }

  // Getter and setter properties for all SSR parameters
  get geometryBuffer(): Texture | null {
    return this.rawEffect.geometryBuffer;
  }
  set geometryBuffer(v: Texture | null) {
    this.rawEffect.geometryBuffer = v;
    this.options.geometryBuffer = v;
    this.emit("_needsUpdate");
  }

  get resolutionScale(): number {
    return this.options.resolutionScale ?? DEFAULT_SSR_OPTIONS.resolutionScale;
  }
  set resolutionScale(v: number) {
    if (!this.rawEffect) return;
    this.options.resolutionScale = v;
    this.rawEffect.resolutionScale = v;
    this.emit("_needsUpdate");
  }

  get iterations(): number {
    return this.options.iterations ?? DEFAULT_SSR_OPTIONS.iterations;
  }
  set iterations(v: number) {
    if (!this.rawEffect) return;
    this.options.iterations = v;
    this.rawEffect.iterations = v;
    this.emit("_needsUpdate");
  }

  get binarySearchIterations(): number {
    return (
      this.options.binarySearchIterations ??
      DEFAULT_SSR_OPTIONS.binarySearchIterations
    );
  }
  set binarySearchIterations(v: number) {
    if (!this.rawEffect) return;
    this.options.binarySearchIterations = v;
    this.rawEffect.binarySearchIterations = v;
    this.emit("_needsUpdate");
  }

  get pixelZSize(): number {
    return this.options.pixelZSize ?? DEFAULT_SSR_OPTIONS.pixelZSize;
  }
  set pixelZSize(v: number) {
    if (!this.rawEffect) return;
    this.options.pixelZSize = v;
    this.rawEffect.pixelZSize = v;
    this.emit("_needsUpdate");
  }

  get pixelStride(): number {
    return this.options.pixelStride ?? DEFAULT_SSR_OPTIONS.pixelStride;
  }
  set pixelStride(v: number) {
    if (!this.rawEffect) return;
    this.options.pixelStride = v;
    this.rawEffect.pixelStride = v;
    this.emit("_needsUpdate");
  }

  get pixelStrideZCutoff(): number {
    return (
      this.options.pixelStrideZCutoff ?? DEFAULT_SSR_OPTIONS.pixelStrideZCutoff
    );
  }
  set pixelStrideZCutoff(v: number) {
    if (!this.rawEffect) return;
    this.options.pixelStrideZCutoff = v;
    this.rawEffect.pixelStrideZCutoff = v;
    this.emit("_needsUpdate");
  }

  get maxRayDistance(): number {
    return this.options.maxRayDistance ?? DEFAULT_SSR_OPTIONS.maxRayDistance;
  }
  set maxRayDistance(v: number) {
    if (!this.rawEffect) return;
    this.options.maxRayDistance = v;
    this.rawEffect.maxRayDistance = v;
    this.emit("_needsUpdate");
  }

  get screenEdgeFadeStart(): number {
    return (
      this.options.screenEdgeFadeStart ??
      DEFAULT_SSR_OPTIONS.screenEdgeFadeStart
    );
  }
  set screenEdgeFadeStart(v: number) {
    if (!this.rawEffect) return;
    this.options.screenEdgeFadeStart = v;
    this.rawEffect.screenEdgeFadeStart = v;
    this.emit("_needsUpdate");
  }

  get eyeFadeStart(): number {
    return this.options.eyeFadeStart ?? DEFAULT_SSR_OPTIONS.eyeFadeStart;
  }
  set eyeFadeStart(v: number) {
    if (!this.rawEffect) return;
    this.options.eyeFadeStart = v;
    this.rawEffect.eyeFadeStart = v;
    this.emit("_needsUpdate");
  }

  get eyeFadeEnd(): number {
    return this.options.eyeFadeEnd ?? DEFAULT_SSR_OPTIONS.eyeFadeEnd;
  }
  set eyeFadeEnd(v: number) {
    if (!this.rawEffect) return;
    this.options.eyeFadeEnd = v;
    this.rawEffect.eyeFadeEnd = v;
    this.emit("_needsUpdate");
  }

  get jitter(): number {
    return this.options.jitter ?? DEFAULT_SSR_OPTIONS.jitter;
  }
  set jitter(v: number) {
    if (!this.rawEffect) return;
    this.options.jitter = v;
    this.rawEffect.jitter = v;
    this.emit("_needsUpdate");
  }

  get roughness(): number {
    return this.options.roughness ?? DEFAULT_SSR_OPTIONS.roughness;
  }
  set roughness(v: number) {
    if (!this.rawEffect) return;
    this.options.roughness = v;
    this.rawEffect.roughness = v;
    this.emit("_needsUpdate");
  }

  get useConeTracing(): boolean {
    return this.options.useConeTracing ?? DEFAULT_SSR_OPTIONS.useConeTracing;
  }
  set useConeTracing(v: boolean) {
    if (!this.rawEffect) return;
    this.options.useConeTracing = v;
    this.rawEffect.useConeTracing = v;
    this.emit("_needsUpdate");
  }

  get coneTracingFadeStart(): number {
    return (
      this.options.coneTracingFadeStart ??
      DEFAULT_SSR_OPTIONS.coneTracingFadeStart
    );
  }
  set coneTracingFadeStart(v: number) {
    if (!this.rawEffect) return;
    this.options.coneTracingFadeStart = v;
    this.rawEffect.coneTracingFadeStart = v;
    this.emit("_needsUpdate");
  }

  get coneTracingFadeEnd(): number {
    return (
      this.options.coneTracingFadeEnd ?? DEFAULT_SSR_OPTIONS.coneTracingFadeEnd
    );
  }
  set coneTracingFadeEnd(v: number) {
    if (!this.rawEffect) return;
    this.options.coneTracingFadeEnd = v;
    this.rawEffect.coneTracingFadeEnd = v;
    this.emit("_needsUpdate");
  }

  get coneTracingMaxDistance(): number {
    return (
      this.options.coneTracingMaxDistance ??
      DEFAULT_SSR_OPTIONS.coneTracingMaxDistance
    );
  }
  set coneTracingMaxDistance(v: number) {
    if (!this.rawEffect) return;
    this.options.coneTracingMaxDistance = v;
    this.rawEffect.coneTracingMaxDistance = v;
    this.emit("_needsUpdate");
  }

  get coneTracingIteration(): number {
    return (
      this.options.coneTracingIteration ??
      DEFAULT_SSR_OPTIONS.coneTracingIteration
    );
  }
  set coneTracingIteration(v: number) {
    if (!this.rawEffect) return;
    this.options.coneTracingIteration = v;
    this.rawEffect.coneTracingIteration = v;
    this.emit("_needsUpdate");
  }
}
