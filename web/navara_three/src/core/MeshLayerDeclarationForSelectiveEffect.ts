import type { BaseEventMap } from "@navara/core";
import { Object3D } from "three";

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

export abstract class MeshLayerDeclarationForSelectiveEffect<
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

  constructor(view: ViewContext, config?: Config) {
    const resolvedConfig = config ?? ({} as Config);
    super(view, resolvedConfig);
    this._effectIds = resolvedConfig.effectIds ?? [];
  }

  protected override getPassKey(): PassKey {
    // Meshes with SelectiveEffect (effectIds) need to be in MRT scene for SE buffer rendering
    if (this._effectIds.length > 0) {
      return "mrt";
    }
    return super.getPassKey();
  }

  override onCreate() {
    super.onCreate();

    // ----------------------------------------------------------------------------
    // SelectiveEffect: effectIds wiring
    // ----------------------------------------------------------------------------
    const useSelectiveEffect = this._effectIds.length > 0;
    if (useSelectiveEffect && this.raw) {
      // Update Helper links for Selective Effect buffer rendering
      this.view.selectiveEffectRegistry?.updateLinksForObject(
        this.raw,
        this._effectIds,
        [],
        this.id,
      );
    }

    // Register with Manager (SoT) if effectIds is specified
    if (useSelectiveEffect) {
      this.view.registerLayerEffects(this.id, this._effectIds);
    }
  }

  override onUpdateConfig(updates: UpdateConfig): void {
    // ----------------------------------------------------------------------------
    // SelectiveEffect: effectIds update
    // Update _effectIds BEFORE super.onUpdateConfig() so getPassKey() returns correct value
    // ----------------------------------------------------------------------------
    let effectIdsChanged = false;
    let prevEffectIds: string[] = [];

    if (updates.effectIds !== undefined) {
      prevEffectIds = this._effectIds;
      const nextEffectIds = updates.effectIds ?? [];

      if (!arraysEqual(prevEffectIds, nextEffectIds)) {
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
    if (effectIdsChanged && this.raw) {
      // Update Helper links for Selective Effect buffer rendering
      this.view.selectiveEffectRegistry?.updateLinksForObject(
        this.raw,
        this._effectIds,
        prevEffectIds,
        this.id,
      );

      // Update Manager (SoT) with new effectIds
      this.view.updateLayerEffects(this.id, this._effectIds);
    }

    // Note: onPassKeyChange() is already called by super.onUpdateConfig()
  }

  override onDestroy(): void {
    // ----------------------------------------------------------------------------
    // SelectiveEffect: cleanup
    // ----------------------------------------------------------------------------
    if (this._effectIds.length > 0 && this.raw) {
      this.view.selectiveEffectRegistry?.updateLinksForObject(
        this.raw,
        [],
        this._effectIds,
        this.id,
      );
      this._effectIds = [];
    }

    // Unregister layer effects
    this.view.unregisterLayerEffects(this.id);

    super.onDestroy();
  }
}
