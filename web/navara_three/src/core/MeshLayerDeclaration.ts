import { Object3D } from "three";

import type { Scenes } from "../scene";
import type { LayerPosition } from "../type";

import {
  LayerDeclaration,
  type BaseInstance,
  type LayerDeclarationConfig,
  type LayerDeclarationConfigUpdate,
} from "./LayerDeclaration";
import type { ViewContext } from "./ViewContext";

export type MeshLayerConfig = {
  type: "mesh";
  position?: LayerPosition;
} & LayerDeclarationConfig;

export type MeshLayerUpdate = Pick<MeshLayerConfig, "position"> &
  LayerDeclarationConfigUpdate;

type PassKey = keyof Pick<Scenes, "opaque" | "transparent">;

export type MeshBaseInstance<Instance extends object = object> =
  Instance extends Object3D
    ? Instance
    : Instance extends {
          raw: infer Raw extends Object3D;
        }
      ? Instance & { raw: Raw } & BaseInstance
      : BaseInstance;

export abstract class MeshLayerDeclaration<
  Config extends MeshLayerConfig = MeshLayerConfig,
  UpdateConfig extends MeshLayerUpdate = MeshLayerUpdate,
  InstanceObj extends object = object,
  Instance extends
    MeshBaseInstance<InstanceObj> = MeshBaseInstance<InstanceObj>,
> extends LayerDeclaration<Config, UpdateConfig, Instance> {
  public position?: LayerPosition;
  private prevPassKey?: PassKey;

  constructor(view: ViewContext, config: Config = {} as Config) {
    super(view, config);
    this.position = config.position;
  }

  protected getPassKey(): PassKey {
    return "opaque";
  }

  abstract createMesh(): Instance;

  get raw() {
    if (!this._instance) return null;

    if (this._instance instanceof Object3D) {
      return this._instance;
    }
    if ("raw" in this._instance) {
      return this._instance.raw;
    }
    return null;
  }

  async onCreate() {
    this._instance = this.createMesh();

    if (this.position) {
      this.raw?.position.copy(this.position);
    }

    this._instance.visible = this.visible;

    this.onPassKeyChange();
  }

  removeFromScene(passKey: PassKey) {
    if (!this.raw) return;

    const scenes = this.view.scenes;

    if (scenes[passKey]) {
      scenes[passKey].remove(this.raw);
    }
  }

  addToScene(passKey: PassKey) {
    if (!this.raw) return;

    const scenes = this.view.scenes;

    if (scenes[passKey]) {
      scenes[passKey].add(this.raw);
    }
  }

  onUpdateConfig(updates: UpdateConfig): void {
    super.onUpdateConfig(updates);

    if (updates.position !== undefined) {
      this.position = updates.position;
      this.raw?.position.copy(updates.position);
    }

    this.onPassKeyChange();
  }

  onPassKeyChange() {
    const nextPassKey = this.getPassKey();
    if (this.prevPassKey === nextPassKey) return;
    if (this.prevPassKey) {
      this.removeFromScene(this.prevPassKey);
    }
    this.prevPassKey = nextPassKey;
    this.addToScene(nextPassKey);
  }

  onDestroy(): void {
    if (this.raw && this.raw.parent) {
      this.raw.parent.remove(this.raw);
    }

    this._instance = null;
  }

  update?(time: number): void;
}
