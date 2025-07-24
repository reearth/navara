import { Pass as PostProcessingPass } from "postprocessing";

import {
  LayerDeclaration,
  type BaseInstance,
  type LayerDeclarationConfig,
  type LayerDeclarationConfigUpdate,
} from "./LayerDeclaration";
import type { ViewContext } from "./ViewContext";

export type EffectLayerConfig = {
  type: "effect";
} & LayerDeclarationConfig;

export type EffectLayerUpdate = LayerDeclarationConfigUpdate;

export type EffectBaseInstance<Instance extends object = object> =
  Instance extends PostProcessingPass
    ? Instance & BaseInstance
    : Instance extends {
          raw: infer Raw extends PostProcessingPass;
        }
      ? Instance & { raw: Raw } & BaseInstance
      : BaseInstance;

export abstract class EffectLayerDeclaration<
  Config extends EffectLayerConfig = EffectLayerConfig,
  UpdateConfig extends EffectLayerUpdate = EffectLayerUpdate,
  InstanceObj extends object = object,
  Instance extends
    EffectBaseInstance<InstanceObj> = EffectBaseInstance<InstanceObj>,
> extends LayerDeclaration<Config, UpdateConfig, Instance> {
  // Static properties for pass ordering - subclasses must define these
  static key: string;
  static insertAfter?: string[];
  static insertBefore?: string[];

  constructor(view: ViewContext, config: Config = {} as Config) {
    super(view, config);
  }

  abstract createPass(): Instance;

  get raw() {
    if (!this._instance) return null;

    if (this._instance instanceof PostProcessingPass) {
      return this._instance;
    }
    if ("raw" in this._instance) {
      return this._instance.raw;
    }
    return null;
  }

  getKey(): string {
    return (this.constructor as typeof EffectLayerDeclaration).key;
  }

  async onCreate() {
    this._instance = this.createPass();

    if (this._instance) {
      this._instance.visible = this.visible;
    }

    // Insert the pass with proper ordering
    if (this.raw) {
      this.insertPass();
    }
  }

  private insertPass(): void {
    if (!this.raw) return;

    const key = this.getKey();
    const EffectClass = this.constructor as typeof EffectLayerDeclaration;
    const insertAfter = EffectClass.insertAfter || [];
    const insertBefore = EffectClass.insertBefore || [];

    // Try insertAfter first
    for (const target of insertAfter) {
      if (this.view.renderPassOrchestrator.getPass(target)) {
        this.view.renderPassOrchestrator.insertPassAfter(target, key, this.raw);
        return;
      }
    }

    // Try insertBefore if no insertAfter worked
    for (const target of insertBefore) {
      if (this.view.renderPassOrchestrator.getPass(target)) {
        this.view.renderPassOrchestrator.insertPassBefore(
          target,
          key,
          this.raw,
        );
        return;
      }
    }

    // Default: add to end
    this.view.renderPassOrchestrator.addPass(key, this.raw);
  }

  onUpdateConfig(updates: UpdateConfig): void {
    super.onUpdateConfig(updates);
  }

  onDestroy(): void {
    // Remove from orchestrator
    if (this.view.renderPassOrchestrator) {
      this.view.renderPassOrchestrator.removePass(this.getKey());
    }

    this._instance = null;
  }

  update?(time: number): void;

  findLayer<Layer extends EffectLayerDeclaration = EffectLayerDeclaration>(
    key: string,
  ) {
    for (const handle of this.view.layersManager.getEffectLayers()) {
      const layer = handle.getLayer();
      if (layer.getKey() !== key) {
        continue;
      }
      return layer as Layer;
    }
  }
}
