import {
  EffectLayerDeclaration,
  type EffectLayerConfig,
  type EffectLayerUpdate,
  type ViewContext,
  ToneMapping,
  type ToneMappingOptions,
} from "@navara/three";

type LayerDescription = {
  toneMapping?: Omit<ToneMappingOptions, "enabled">;
};

export type ToneMappingConfig = LayerDescription & EffectLayerConfig;

export type ToneMappingUpdate = LayerDescription & EffectLayerUpdate;

export class ToneMappingEffectLayer extends EffectLayerDeclaration<
  ToneMappingConfig,
  ToneMappingUpdate,
  ToneMapping
> {
  static key = "toneMapping";
  static insertBefore = ["final"];

  private config: ToneMappingConfig;

  constructor(view: ViewContext, config: ToneMappingConfig) {
    super(view, config);
    this.config = config;
  }

  createPass() {
    const pass = new ToneMapping(this.view.camera, {
      ...this.config.toneMapping,
      enabled: this.config.visible ?? true,
    });

    return pass;
  }

  onUpdateConfig(updates: ToneMappingUpdate): void {
    super.onUpdateConfig(updates);

    if (!this._instance) return;
    Object.assign(this.config, updates);

    const config = updates.toneMapping;
    if (!config) return;

    if (config.mode !== undefined) {
      this._instance.mode = config.mode;
    }
  }
}
