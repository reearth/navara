import {
  EffectLayerDeclaration,
  type EffectLayerConfig,
  type EffectLayerUpdate,
  type ViewContext,
} from "@navara/three";

import { SSAO, type SSAOOptions } from "./ssao";

type LayerDescription = {
  ssao?: Omit<SSAOOptions, "enabled">;
};

export type SSAOConfig = LayerDescription & EffectLayerConfig;

export type SSAOUpdate = LayerDescription & EffectLayerUpdate;

export class SSAOEffectLayer extends EffectLayerDeclaration<
  SSAOConfig,
  SSAOUpdate,
  SSAO
> {
  static key = "ssao";
  static insertAfter = ["clouds"];
  static insertBefore = ["transparent"];

  private config: SSAOConfig;

  constructor(view: ViewContext, config: SSAOConfig) {
    super(view, config);
    this.config = config;
  }

  createPass() {
    // Convert config to SSAOOptions format
    const ssaoOptions: SSAOOptions = this.config.ssao
      ? { ...this.config.ssao }
      : {};

    const pass = new SSAO(
      this.view.camera,
      this.view.getRenderer().domElement.clientWidth,
      this.view.getRenderer().domElement.clientHeight,
      {
        ...ssaoOptions,
        enabled: this.config.visible ?? true,
      },
    );

    // TODO: Support SSAO when `hideUnderground` is true.
    // To support it, N8AOPostPass needs to allow taking `RGBADepthPacking` in `setDepthTexture`.
    // Ref: https://github.com/N8python/n8ao/blob/master/src/N8AOPostPass.js#L533
    // const mrtPass = this.findLayer<MRTPassEffectLayer>("mrt");
    // invariant(mrtPass?.depthBuffer);
    // pass.raw.setDepthTexture(mrtPass.depthBuffer, mrtPass.depthBufferPacking);

    return pass;
  }

  onUpdateConfig(updates: SSAOUpdate): void {
    super.onUpdateConfig(updates);

    if (!this._instance) return;
    Object.assign(this.config, updates);

    const config = updates.ssao;
    if (!config) return;

    if (config.samples !== undefined) {
      this._instance.samples = config.samples;
    }
    if (config.radius !== undefined) {
      this._instance.radius = config.radius;
    }
    if (config.intensity !== undefined) {
      this._instance.intensity = config.intensity;
    }
    if (config.color !== undefined) {
      this._instance.color = config.color;
    }
    if (config.halfRes !== undefined) {
      this._instance.halfRes = config.halfRes ?? false;
    }
    if (config.quality !== undefined) {
      this._instance.quality = config.quality;
    }
  }
}
