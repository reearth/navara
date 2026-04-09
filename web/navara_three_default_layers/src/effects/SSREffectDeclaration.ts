import {
  EffectDeclaration,
  type EffectConfig,
  type EffectUpdate,
  type ViewContext,
  type MRTPassEffectDeclaration,
} from "@navara/three";
import invariant from "tiny-invariant";

import { SSR, type SSROptions } from "./ssr";

type LayerDescription = {
  ssr?: Omit<SSROptions, "enabled" | "geometryBuffer">;
};

export type SSRConfig = LayerDescription & EffectConfig;

export type SSRUpdate = LayerDescription & EffectUpdate;

export class SSREffectDeclaration extends EffectDeclaration<
  SSRConfig,
  SSRUpdate,
  SSR
> {
  static key = "ssr";
  static insertAfter = ["toneMapping"];
  static insertBefore = ["final"];

  private config: SSRConfig;

  constructor(view: ViewContext, config: SSRConfig) {
    super(view, config);
    this.config = config;
  }

  createPass() {
    const mrtPass = this.findLayer<MRTPassEffectDeclaration>("mrt");
    invariant(mrtPass?.normalBuffer);

    const pass = new SSR(this.view.camera, {
      ...this.config.ssr,
      geometryBuffer: mrtPass.normalBuffer,
      enabled: this.config.visible ?? true,
    });

    return pass;
  }

  onUpdateConfig(updates: SSRUpdate): void {
    super.onUpdateConfig(updates);

    if (!this._instance) return;
    Object.assign(this.config, updates);

    const config = updates.ssr;
    if (!config) return;

    // Update all SSR properties
    if (config.resolutionScale !== undefined) {
      this._instance.resolutionScale = config.resolutionScale;
    }
    if (config.iterations !== undefined) {
      this._instance.iterations = config.iterations;
    }
    if (config.binarySearchIterations !== undefined) {
      this._instance.binarySearchIterations = config.binarySearchIterations;
    }
    if (config.pixelZSize !== undefined) {
      this._instance.pixelZSize = config.pixelZSize;
    }
    if (config.pixelStride !== undefined) {
      this._instance.pixelStride = config.pixelStride;
    }
    if (config.pixelStrideZCutoff !== undefined) {
      this._instance.pixelStrideZCutoff = config.pixelStrideZCutoff;
    }
    if (config.maxRayDistance !== undefined) {
      this._instance.maxRayDistance = config.maxRayDistance;
    }
    if (config.screenEdgeFadeStart !== undefined) {
      this._instance.screenEdgeFadeStart = config.screenEdgeFadeStart;
    }
    if (config.eyeFadeStart !== undefined) {
      this._instance.eyeFadeStart = config.eyeFadeStart;
    }
    if (config.eyeFadeEnd !== undefined) {
      this._instance.eyeFadeEnd = config.eyeFadeEnd;
    }
    if (config.jitter !== undefined) {
      this._instance.jitter = config.jitter;
    }
    if (config.useConeTracing !== undefined) {
      this._instance.useConeTracing = config.useConeTracing;
    }
    if (config.coneTracingFadeStart !== undefined) {
      this._instance.coneTracingFadeStart = config.coneTracingFadeStart;
    }
    if (config.coneTracingFadeEnd !== undefined) {
      this._instance.coneTracingFadeEnd = config.coneTracingFadeEnd;
    }
    if (config.coneTracingMaxDistance !== undefined) {
      this._instance.coneTracingMaxDistance = config.coneTracingMaxDistance;
    }
    if (config.coneTracingIteration !== undefined) {
      this._instance.coneTracingIteration = config.coneTracingIteration;
    }
    if (config.coneTracingIor !== undefined) {
      this._instance.coneTracingIor = config.coneTracingIor;
    }
  }
}
