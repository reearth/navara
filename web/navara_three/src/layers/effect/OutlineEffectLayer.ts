import invariant from "tiny-invariant";

import {
  EffectLayerDeclaration,
  type EffectLayerConfig,
  type EffectLayerUpdate,
  ViewContext,
} from "../../core";
import { Outline, type OutlineOptions } from "../../effects";

import type { MRTPassEffectLayer } from "./MRTPassEffectLayer";

type LayerDescription = {
  outline?: Omit<OutlineOptions, "enabled">;
};

export type OutlineConfig = LayerDescription & EffectLayerConfig;

export type OutlineUpdate = LayerDescription & EffectLayerUpdate;

export class OutlineEffectLayer extends EffectLayerDeclaration<
  OutlineConfig,
  OutlineUpdate,
  Outline
> {
  static key = "outline";
  static insertBefore = ["toneMapping", "final"];

  private config: OutlineConfig;

  constructor(view: ViewContext, config: OutlineConfig) {
    super(view, config);
    this.config = config;
  }

  createPass() {
    const mrtPass = this.findLayer<MRTPassEffectLayer>("mrt");
    invariant(mrtPass?.raw);

    const pass = new Outline(this.view.camera, {
      ...this.config.outline,
      enabled: this.config.visible ?? true,
      normalBuffer: mrtPass.raw.gbufferRenderTarget.textures[1],
    });

    return pass;
  }

  onUpdateConfig(updates: OutlineUpdate): void {
    super.onUpdateConfig(updates);

    if (!this._instance) return;
    Object.assign(this.config, updates);

    const config = updates.outline;
    if (!config) return;

    if (config.blendFunction !== undefined) {
      this._instance.blendFunction = config.blendFunction;
    }
    if (config.opacity !== undefined) {
      this._instance.opacity = config.opacity;
    }
    if (config.normalBuffer !== undefined) {
      this._instance.normalBuffer = config.normalBuffer;
    }
    if (config.depthOutlineThickness !== undefined) {
      this._instance.depthOutlineThickness = config.depthOutlineThickness;
    }
    if (config.depthBias !== undefined) {
      this._instance.depthBias = config.depthBias;
    }
    if (config.normalOutlineThickness !== undefined) {
      this._instance.normalOutlineThickness = config.normalOutlineThickness;
    }
    if (config.normalBias !== undefined) {
      this._instance.normalBias = config.normalBias;
    }
  }
}
