import invariant from "tiny-invariant";

import {
  EffectLayerDeclaration,
  type EffectLayerConfig,
  type EffectLayerUpdate,
} from "../../core/EffectLayerDeclaration";
import type { ViewContext } from "../../core/ViewContext";
import { SSR, type SSROptions } from "../../effects/ssr";

import type { MRTPassEffectLayer } from "./MRTPassEffectLayer";

type LayerDescription = {
  ssr?: Omit<SSROptions, "enabled" | "geometryBuffer">;
};

export type SSRConfig = LayerDescription & EffectLayerConfig;

export type SSRUpdate = LayerDescription & EffectLayerUpdate;

export class SSREffectLayer extends EffectLayerDeclaration<
  SSRConfig,
  SSRUpdate,
  SSR
> {
  static key = "ssr";
  static insertAfter = ["ssao"];

  private config: SSRConfig;

  constructor(view: ViewContext, config: SSRConfig) {
    super(view, config);
    this.config = config;
  }

  createPass() {
    const mrtPass = this.findLayer<MRTPassEffectLayer>("mrt");
    invariant(mrtPass?.raw);

    const pass = new SSR(this.view.camera, {
      ...this.config.ssr,
      geometryBuffer: mrtPass.raw.gbufferRenderTarget.textures[1],
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
    if (config.roughness !== undefined) {
      this._instance.roughness = config.roughness;
    }
  }
}
