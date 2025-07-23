import type { Object3D } from "three";

import type { ThreeVec3 } from "../abstracs/vec3";
import type { Scenes } from "../scene";

import {
  LayerDeclaration,
  type LayerDeclarationConfig,
  type LayerDeclarationConfigUpdate,
} from "./LayerDeclaration";
import type { LayerView } from "./LayerView";

export type MeshLayerConfig = {
  type?: "mesh";
  position?: ThreeVec3;
} & LayerDeclarationConfig;

export type MeshLayerUpdate = {
  position?: ThreeVec3;
} & LayerDeclarationConfigUpdate;

type PassKey = keyof Pick<Scenes, "opaque" | "transparent">;

export abstract class MeshLayerDeclaration<
  Config extends MeshLayerConfig = MeshLayerConfig,
  UpdateConfig extends MeshLayerUpdate = MeshLayerUpdate,
  Instance extends Object3D = Object3D,
> extends LayerDeclaration<Config, UpdateConfig, Instance> {
  public position?: ThreeVec3;
  private prevPassKey?: PassKey;

  constructor(view: LayerView, config: Config = {} as Config) {
    super(view, config);
    this.position = config.position;
  }

  protected getPassKey(): PassKey {
    return "opaque";
  }

  abstract createMesh(): Instance;

  onCreate(): void {
    this._instance = this.createMesh();

    if (this.position && this._instance) {
      this._instance.position.copy(this.position._raw);
    }

    this._instance.visible = this.visible;

    this.onPassKeyChange();
  }

  removeFromScene(passKey: PassKey) {
    if (!this._instance) return;

    const scenes = this.view.scenes;

    if (scenes[passKey]) {
      scenes[passKey].remove(this._instance);
    }
  }

  addToScene(passKey: PassKey) {
    if (!this._instance) return;

    const scenes = this.view.scenes;

    if (scenes[passKey]) {
      scenes[passKey].add(this._instance);
    }
  }

  onUpdateConfig(updates: UpdateConfig): void {
    super.onUpdateConfig(updates);

    if (updates.position !== undefined) {
      this.position = updates.position;
      this._instance?.position.copy(updates.position._raw);
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

  onRenderUpdate = (time: number) => {
    if (this.visible && this.update) {
      this.update(time);
    }
  };

  onDestroy(): void {
    if (this._instance && this._instance.parent) {
      this._instance.parent.remove(this._instance);
    }

    this._instance = null;
  }

  update?(time: number): void;
}
