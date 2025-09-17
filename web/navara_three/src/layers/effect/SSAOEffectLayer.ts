import {
  EffectLayerDeclaration,
  type EffectLayerConfig,
  type EffectLayerUpdate,
} from "../../core/EffectLayerDeclaration";
import type { ViewContext } from "../../core/ViewContext";
import { SSAO, type SSAOOptions } from "../../effects";

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
    const pass = new SSAO(
      this.view.camera,
      this.view.renderPassOrchestrator.effectComposer.getRenderer().domElement.clientWidth,
      this.view.renderPassOrchestrator.effectComposer.getRenderer().domElement.clientHeight,
      {
        ...this.config.ssao,
        enabled: this.config.visible ?? true,
      },
    );

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
