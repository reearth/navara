import type { BaseEventMap } from "@navara/core";
import { Mesh, type Object3D } from "three";

import { arraysEqual } from "../utils";

import {
  MeshLayerDeclaration,
  type MeshLayerConfig,
  type MeshLayerUpdate,
  type MeshBaseInstance,
  type PassKey,
} from "./MeshLayerDeclaration";
import type { ViewContext } from "./ViewContext";

export type MeshLayerConfigWithSelectiveEffect = MeshLayerConfig & {
  effectIds?: string[];
};

export type MeshLayerUpdateWithSelectiveEffect = MeshLayerUpdate & {
  effectIds?: string[];
};

export abstract class MeshLayerDeclarationWithSelectiveEffect<
  Config extends MeshLayerConfigWithSelectiveEffect =
    MeshLayerConfigWithSelectiveEffect,
  UpdateConfig extends MeshLayerUpdateWithSelectiveEffect =
    MeshLayerUpdateWithSelectiveEffect,
  InstanceObj extends Object3D | { raw: Object3D } =
    | Object3D
    | { raw: Object3D },
  CustomEvent extends BaseEventMap = BaseEventMap,
  Instance extends MeshBaseInstance<InstanceObj> =
    MeshBaseInstance<InstanceObj>,
> extends MeshLayerDeclaration<
  Config,
  UpdateConfig,
  InstanceObj,
  CustomEvent,
  Instance
> {
  private _effectIds: string[] = [];
  private _onSlotsChanged = () => this.updateEffectIdsMask();

  constructor(view: ViewContext, config?: Config) {
    const resolvedConfig = config ?? ({} as Config);
    super(view, resolvedConfig);
    this._effectIds = resolvedConfig.effectIds ?? [];
  }

  protected override getPassKey(): PassKey {
    // Meshes with SelectiveEffect (effectIds) need to be in MRT scene for SelectiveEffect buffer rendering
    if (this._effectIds.length > 0) {
      return "mrt";
    }
    return super.getPassKey();
  }

  override onCreate() {
    super.onCreate();

    // Compute and set effectIdsMask on material uniforms
    this.updateEffectIdsMask();

    // Recompute mask when slot assignments change (effect added/removed)
    this.view.on("effectSlotsChanged", this._onSlotsChanged);
  }

  override onUpdateConfig(updates: UpdateConfig): void {
    // ----------------------------------------------------------------------------
    // SelectiveEffect: effectIds update
    // Update _effectIds BEFORE super.onUpdateConfig() so getPassKey() returns correct value
    // ----------------------------------------------------------------------------
    let effectIdsChanged = false;

    if (updates.effectIds !== undefined) {
      const nextEffectIds = updates.effectIds ?? [];

      if (!arraysEqual(this._effectIds, nextEffectIds)) {
        // Update local cache first (used by getPassKey())
        this._effectIds = [...nextEffectIds];
        effectIdsChanged = true;
      }
    }

    // super.onUpdateConfig() calls onPassKeyChange() internally
    super.onUpdateConfig(updates);

    // ----------------------------------------------------------------------------
    // SelectiveEffect: registry update (requires this.raw)
    // ----------------------------------------------------------------------------
    if (effectIdsChanged) {
      // Recompute effectIdsMask for material uniforms
      this.updateEffectIdsMask();
    }

    // Note: onPassKeyChange() is already called by super.onUpdateConfig()
  }

  /**
   * Compute effectIdsMask from SelectiveEffectRegistry and set on the mesh's material.
   */
  protected updateEffectIdsMask(): void {
    const registry = this.view.selectiveEffectRegistry;
    if (!registry) return;

    const mask =
      this._effectIds.length > 0 ? registry.computeMask(this._effectIds) : 0;
    const raw = this.raw;
    if (
      raw instanceof Mesh &&
      !Array.isArray(raw.material) &&
      raw.material?.userData?.uEffectIdsMask
    ) {
      raw.material.userData.uEffectIdsMask.value = mask;
    }
  }

  override onDestroy(): void {
    // ----------------------------------------------------------------------------
    // SelectiveEffect: cleanup
    // ----------------------------------------------------------------------------
    this._effectIds = [];

    // Unsubscribe from slot changes
    this.view.off("effectSlotsChanged", this._onSlotsChanged);

    super.onDestroy();
  }
}
