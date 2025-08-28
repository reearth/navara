import {
  Pass as PostProcessingPass,
  Effect as PostProcessingEffect,
} from "postprocessing";
import invariant from "tiny-invariant";

import { Pass } from "../effects";

import {
  LayerDeclaration,
  type BaseInstance,
  type LayerDeclarationConfig,
  type LayerDeclarationConfigUpdate,
} from "./LayerDeclaration";
import type { ViewContext } from "./ViewContext";

type EffectInstance =
  | PostProcessingPass
  | Pass<PostProcessingPass, PostProcessingEffect>;

export type EffectLayerConfig = {
  type: "effect";
} & LayerDeclarationConfig;

export type EffectLayerUpdate = LayerDeclarationConfigUpdate;

export type EffectBaseInstance<Instance extends object = object> =
  Instance extends EffectInstance
    ? Instance & BaseInstance
    : Instance extends {
          raw: infer Raw extends PostProcessingPass;
        }
      ? Instance & { raw: Raw } & BaseInstance
      : BaseInstance;

export abstract class EffectLayerDeclaration<
  Config extends EffectLayerConfig = EffectLayerConfig,
  UpdateConfig extends EffectLayerUpdate = EffectLayerUpdate,
  InstanceObj extends EffectInstance | { raw: EffectInstance } =
    | EffectInstance
    | { raw: EffectInstance },
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
    if (!this._instance) return;

    if (
      this._instance instanceof PostProcessingPass ||
      this._instance instanceof Pass
    ) {
      return this._instance as Instance extends EffectInstance
        ? Instance
        : never;
    }

    if ("raw" in this._instance) {
      return this._instance.raw as Instance;
    }
  }

  getConstructor() {
    return (this.constructor as typeof EffectLayerDeclaration);
  }

  getKey(): string {
    return this.getConstructor().key;
  }

  getInsertAfter() {
    return this.getConstructor().insertAfter;
  }

  getInsertBefore() {
    return this.getConstructor().insertBefore;
  }

  onCreate() {
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
    const insertAfter = this.getInsertAfter() || [];
    const insertBefore = this.getInsertBefore() || [];

    const raw = this.raw;
    const c =
      raw instanceof Pass
        ? raw.rawPass
        : raw instanceof PostProcessingPass
          ? raw
          : undefined;
    invariant(c);

    // Try insertAfter first
    for (const target of insertAfter) {
      if (this.view.renderPassOrchestrator.getPass(target)) {
        this.view.renderPassOrchestrator.insertPassAfter(target, key, c);
        return;
      }
    }

    // Try insertBefore if no insertAfter worked
    for (const target of insertBefore) {
      if (this.view.renderPassOrchestrator.getPass(target)) {
        this.view.renderPassOrchestrator.insertPassBefore(target, key, c);
        return;
      }
    }

    // Default: add to end
    this.view.renderPassOrchestrator.addPass(key, c);
  }

  onUpdateConfig(updates: UpdateConfig): void {
    super.onUpdateConfig(updates);
  }

  onDestroy(): void {
    // Remove from orchestrator
    if (this.view.renderPassOrchestrator) {
      this.view.renderPassOrchestrator.removePass(this.getKey());
    }

    this._instance = undefined;
  }

  update?(time: number): void;

  findLayer<Layer extends EffectLayerDeclaration = EffectLayerDeclaration>(
    key: string,
  ) {
    for (const handle of this.view.layersManager.getEffectLayers()) {
      const layer = handle.ref;
      if (layer.getKey() !== key) {
        continue;
      }
      return layer as Layer;
    }
  }
}
