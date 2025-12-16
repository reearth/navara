import type { BaseEventMap, XYZ } from "@navara/core";
import { Object3D } from "three";

import type { Scenes } from "../scene";
import { arraysEqual } from "../utils";

import {
  LayerDeclaration,
  type BaseInstance,
  type LayerDeclarationConfig,
  type LayerDeclarationConfigUpdate,
} from "./LayerDeclaration";
import {
  type PostEffectOcclusion,
  parsePostEffectOcclusion,
} from "./PostEffectHelper";
import type { ViewContext } from "./ViewContext";

export type MeshLayerConfig = {
  type: "mesh";
  position?: XYZ;
  scale?: XYZ;
  rotation?: XYZ;
  effectIds?: string[];
  postEffectOcclusion?: PostEffectOcclusion;
} & LayerDeclarationConfig;

export type MeshLayerUpdate = Pick<
  MeshLayerConfig,
  "position" | "scale" | "rotation"
> &
  LayerDeclarationConfigUpdate & {
    effectIds?: string[];
    postEffectOcclusion?: PostEffectOcclusion;
  };

type PassKey = keyof Pick<
  Scenes,
  "opaque" | "transparent" | "mrt" | "skyEnvMap"
>;

export type MeshBaseInstance<Instance extends object = object> =
  Instance extends Object3D
    ? Instance
    : Instance extends {
          raw: infer Raw extends Object3D;
        }
      ? Instance & { raw: Raw } & BaseInstance
      : Instance & BaseInstance;

export abstract class MeshLayerDeclaration<
  Config extends MeshLayerConfig = MeshLayerConfig,
  UpdateConfig extends MeshLayerUpdate = MeshLayerUpdate,
  InstanceObj extends Object3D | { raw: Object3D } =
    | Object3D
    | { raw: Object3D },
  CustomEvent extends BaseEventMap = BaseEventMap,
  Instance extends
    MeshBaseInstance<InstanceObj> = MeshBaseInstance<InstanceObj>,
> extends LayerDeclaration<Config, UpdateConfig, Instance, CustomEvent> {
  public position?: XYZ;
  public scale?: XYZ;
  public rotation?: XYZ;
  private prevPassKey?: PassKey;
  private _effectIds: string[] = [];
  private _postEffectOcclusion?: PostEffectOcclusion;

  constructor(view: ViewContext, config: Config = {} as Config) {
    super(view, config);
    this.position = config.position;
    this.scale = config.scale;
    this.rotation = config.rotation;
    this._effectIds = config.effectIds ?? [];
    this._postEffectOcclusion = config.postEffectOcclusion;
  }

  protected getPassKey(): PassKey {
    return "opaque";
  }

  abstract createMesh(): Instance;

  get raw() {
    if (!this._instance) return;

    if (this._instance instanceof Object3D) {
      return this._instance as Instance extends Object3D ? Instance : never;
    }
    if ("raw" in this._instance) {
      return this._instance.raw as Instance extends {
        raw: infer Raw extends Object3D;
      }
        ? Raw
        : never;
    }
    return;
  }

  onCreate() {
    this._instance = this.createMesh();

    if (this.position) {
      this.raw?.position.copy(this.position);
    }

    if (this.scale) {
      this.raw?.scale.copy(this.scale);
    }

    if (this.rotation) {
      this.raw?.rotation.set(this.rotation.x, this.rotation.y, this.rotation.z);
    }

    this._instance.visible = this.visible;

    // ----------------------------------------------------------------------------
    // PostEffect: effectIds / occlusion wiring
    // ----------------------------------------------------------------------------
    if (this._effectIds.length > 0 && this.raw) {
      this.view.postEffectRegistry?.updateLinksForObject(
        this.raw,
        this._effectIds,
        [],
        this.id,
      );
    }

    // Register initial postEffectOcclusion
    if (this._postEffectOcclusion !== undefined) {
      const occlusion = parsePostEffectOcclusion(this._postEffectOcclusion);
      if (occlusion !== undefined) {
        this.view.postEffectRegistry?.registerLayerPostEffectOcclusion(
          this.id,
          occlusion,
        );
      }
    }

    this.onPassKeyChange();
  }

  removeFromScene(passKey: PassKey) {
    const scenes = this.view.scenes;

    if (scenes[passKey] && this.raw) {
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

    if (updates.scale !== undefined) {
      this.scale = updates.scale;
      this.raw?.scale.copy(updates.scale);
    }

    if (updates.rotation !== undefined) {
      this.rotation = updates.rotation;
      this.raw?.rotation.set(
        updates.rotation.x,
        updates.rotation.y,
        updates.rotation.z,
      );
    }

    // ----------------------------------------------------------------------------
    // PostEffect: effectIds / occlusion wiring
    // ----------------------------------------------------------------------------
    if (updates.effectIds !== undefined && this.raw) {
      const prevEffectIds = this._effectIds;
      const nextEffectIds = updates.effectIds ?? [];

      if (!arraysEqual(prevEffectIds, nextEffectIds)) {
        this.view.postEffectRegistry?.updateLinksForObject(
          this.raw,
          nextEffectIds,
          prevEffectIds,
          this.id,
        );
        this._effectIds = [...nextEffectIds];
      }
    }

    // Update postEffectOcclusion
    if (updates.postEffectOcclusion !== undefined) {
      this._postEffectOcclusion = updates.postEffectOcclusion;
      const occlusion = parsePostEffectOcclusion(updates.postEffectOcclusion);
      if (occlusion !== undefined) {
        this.view.postEffectRegistry?.updateLayerPostEffectOcclusion(
          this.id,
          occlusion,
        );
      }
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
    // ----------------------------------------------------------------------------
    // PostEffect: effectIds cleanup
    // ----------------------------------------------------------------------------
    if (this._effectIds.length > 0 && this.raw) {
      this.view.postEffectRegistry?.updateLinksForObject(
        this.raw,
        [],
        this._effectIds,
        this.id,
      );
      this._effectIds = [];
    }

    if (this.raw && this.raw.parent) {
      this.raw.parent.remove(this.raw);
    }

    super.onDestroy();
  }

  update?(time: number): void;

  onResize?(width: number, height: number): void;
}
