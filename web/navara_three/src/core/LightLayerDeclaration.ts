import { Light } from "three";

import type { LayerPosition } from "../type";

import {
  LayerDeclaration,
  type BaseInstance,
  type LayerDeclarationConfig,
  type LayerDeclarationConfigUpdate,
} from "./LayerDeclaration";
import type { ViewContext } from "./ViewContext";

export type LightLayerConfig = {
  type: "light";
  position?: LayerPosition;
} & LayerDeclarationConfig;

export type LightLayerUpdate = LayerDeclarationConfigUpdate;

export type LightBaseInstance<Instance extends object = object> =
  Instance extends Light
    ? Instance
    : Instance extends {
          raw: infer Raw extends Light;
        }
      ? Instance & { raw: Raw } & BaseInstance
      : BaseInstance;

export abstract class LightLayerDeclaration<
  Config extends LightLayerConfig = LightLayerConfig,
  UpdateConfig extends LightLayerUpdate = LightLayerUpdate,
  InstanceObj extends object = object,
  Instance extends
    LightBaseInstance<InstanceObj> = LightBaseInstance<InstanceObj>,
> extends LayerDeclaration<Config, UpdateConfig, Instance> {
  public position?: LayerPosition;

  constructor(view: ViewContext, config: Config = {} as Config) {
    super(view, config);
    this.position = config.position;
  }

  abstract createLight(): Instance;

  get raw() {
    if (!this._instance) return null;

    if (this._instance instanceof Light) {
      return this._instance;
    }
    if ("raw" in this._instance) {
      return this._instance.raw;
    }
    return null;
  }

  async onCreate() {
    this._instance = this.createLight();

    if (this._instance) {
      this._instance.visible = this.visible;
    }

    if (this.position) {
      this.raw?.position.copy(this.position);
    }

    // Add to scene
    if (this.raw) {
      this.view.scenes.light.add(this.raw);
    }
  }

  onUpdateConfig(updates: UpdateConfig): void {
    super.onUpdateConfig(updates);
  }

  onDestroy(): void {
    if (this.raw && this.raw.parent) {
      this.raw.parent.remove(this.raw);
    }

    this._instance = null;
  }

  update?(time: number): void;
}
