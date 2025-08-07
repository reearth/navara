import { Light } from "three";

import type { LayerVector3 } from "../type";

import {
  LayerDeclaration,
  type BaseInstance,
  type LayerDeclarationConfig,
  type LayerDeclarationConfigUpdate,
} from "./LayerDeclaration";
import type { ViewContext } from "./ViewContext";

export type LightLayerConfig = {
  type: "light";
  position?: LayerVector3;
} & LayerDeclarationConfig;

export type LightLayerUpdate = Pick<LightLayerConfig, "position"> &
  LayerDeclarationConfigUpdate;

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
  InstanceObj extends Light | { raw: Light } = Light | { raw: Light },
  Instance extends
    LightBaseInstance<InstanceObj> = LightBaseInstance<InstanceObj>,
> extends LayerDeclaration<Config, UpdateConfig, Instance> {
  public position?: LayerVector3;

  constructor(view: ViewContext, config: Config = {} as Config) {
    super(view, config);
    this.position = config.position;
  }

  abstract createLight(): Instance;

  get raw() {
    if (!this._instance) return;

    if (this._instance instanceof Light) {
      return this._instance as Instance extends Light ? Instance : never;
    }
    if ("raw" in this._instance) {
      return this._instance.raw as Instance extends {
        raw: infer Raw extends Light;
      }
        ? Raw
        : never;
    }
    return;
  }

  onCreate() {
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

    this._instance = undefined;
  }

  update?(time: number): void;
}
