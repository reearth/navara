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
import {
  type SelectiveEffectOcclusion,
  parseSelectiveEffectOcclusion,
} from "./SelectiveEffectHelper";
import { injectSelectiveEffectHandlers } from "./SelectiveEffectMaskContext";
import type { ViewContext } from "./ViewContext";

export type MeshLayerConfigWithSelectiveEffect = MeshLayerConfig & {
  effectIds?: string[];
  selectiveEffectOcclusion?: SelectiveEffectOcclusion | null;
};

export type MeshLayerUpdateWithSelectiveEffect = MeshLayerUpdate & {
  effectIds?: string[];
  selectiveEffectOcclusion?: SelectiveEffectOcclusion | null;
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
  private readonly _initialSelectiveEffectOcclusion?: SelectiveEffectOcclusion | null;
  private _effectIds: string[] = [];
  private _hasInjectedHandlers = false;

  constructor(view: ViewContext, config?: Config) {
    const resolvedConfig = config ?? ({} as Config);
    super(view, resolvedConfig);
    this._effectIds = resolvedConfig.effectIds ?? [];
    this._initialSelectiveEffectOcclusion =
      resolvedConfig.selectiveEffectOcclusion;
  }

  protected override getPassKey(): PassKey {
    // Meshes with SelectiveEffect (effectIds) need to be in MRT scene for mask rendering
    if (this._effectIds.length > 0) {
      return "mrt";
    }
    return super.getPassKey();
  }

  override onCreate() {
    super.onCreate();

    // ----------------------------------------------------------------------------
    // SelectiveEffect: effectIds / occlusion wiring
    // ----------------------------------------------------------------------------
    const useSelectiveEffect = this._effectIds.length > 0;
    if (useSelectiveEffect && this.raw) {
      // Update Helper links for mask pass rendering
      this.view.selectiveEffectRegistry?.updateLinksForObject(
        this.raw,
        this._effectIds,
        [],
        this.id,
      );
    }

    // Register with Manager (SoT) if effectIds or occlusion is specified
    const initialOcclusion = this._initialSelectiveEffectOcclusion;
    if (useSelectiveEffect || initialOcclusion !== undefined) {
      const parsedOcclusion =
        initialOcclusion !== undefined && initialOcclusion !== null
          ? parseSelectiveEffectOcclusion(initialOcclusion)
          : undefined;
      this.view.registerLayerEffects(this.id, this._effectIds, parsedOcclusion);
    }

    if (useSelectiveEffect) {
      this.injectHandlers();
    }
  }

  /**
   * Inject onBeforeRender/onAfterRender handlers via shared free function.
   * Standard materials have no shader uniforms, so only material property
   * control (colorWrite, depthWrite, depthTest) is applied.
   */
  private injectHandlers(): void {
    const raw = this.raw;
    if (!raw || this._hasInjectedHandlers) return;

    injectSelectiveEffectHandlers(raw, {
      registry: this.view.selectiveEffectRegistry,
      layerId: this.id,
    });
    this._hasInjectedHandlers = true;
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
      // Update Helper links for mask pass rendering
      this.view.selectiveEffectRegistry?.updateLinksForObject(
        this.raw,
        this._effectIds,
        prevEffectIds,
        this.id,
      );

      // Update Manager (SoT) with new effectIds
      this.view.updateLayerEffects(this.id, this._effectIds);

      // Inject handlers on first transition to having effects
      if (prevEffectIds.length === 0 && this._effectIds.length > 0) {
        this.injectHandlers();
      }
      // Note: When effectIds becomes empty, handlers remain injected but
      // injectSelectiveEffectHandlers internally applies skip state for
      // meshes with no effectIds, so no removal is needed.
    }

    // Update selectiveEffectOcclusion (SoT is SelectiveEffectManager via ViewContext)
    if (updates.selectiveEffectOcclusion !== undefined) {
      if (updates.selectiveEffectOcclusion === null) {
        // Clear occlusion setting (reset to Normal)
        this.view.clearLayerSelectiveEffectOcclusion(this.id);
      } else {
        const occlusion = parseSelectiveEffectOcclusion(
          updates.selectiveEffectOcclusion,
        );
        if (occlusion !== undefined) {
          this.view.setLayerSelectiveEffectOcclusion(this.id, occlusion);
        }
      }
    }

    // Note: onPassKeyChange() is already called by super.onUpdateConfig()
  }

  override onDestroy(): void {
    // ----------------------------------------------------------------------------
    // SelectiveEffect: cleanup
    // ----------------------------------------------------------------------------
    // Note: onAfterRender in injectSelectiveEffectHandlers restores material state
    // automatically. No explicit restore needed here.

    if (this._effectIds.length > 0 && this.raw) {
      this.view.selectiveEffectRegistry?.updateLinksForObject(
        this.raw,
        [],
        this._effectIds,
        this.id,
      );
      this._effectIds = [];
    }

    // Unregister layer effects (clears layerConfigs and occlusionCache)
    this.view.unregisterLayerEffects(this.id);

    super.onDestroy();
  }
}
