import type { BaseEventMap } from "@navara/core";
import { Mesh, Object3D, type Material } from "three";

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
  getSelectiveEffectConfig,
} from "./SelectiveEffectHelper";
import {
  getMaskPassContext,
  MaskPassPhase,
  evaluateMaskPassParticipation,
  applyMaskPassSkipState,
  applyMaskPassRenderState,
  restoreMaterialState,
} from "./SelectiveEffectMaskContext";
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
  private _hasSetupOnBeforeRender = false;
  private _originalOnBeforeRender?: Object3D["onBeforeRender"];

  /**
   * Helper to apply a function to single or array of materials.
   */
  private forEachMaterial(fn: (m: Material) => void): void {
    const raw = this.raw;
    if (!(raw instanceof Mesh)) return;
    const mat = raw.material;
    if (!mat) return;

    if (Array.isArray(mat)) {
      for (const m of mat) {
        fn(m);
      }
    } else {
      fn(mat);
    }
  }

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
      // Setup onBeforeRender for MaskPass context-based rendering
      this.setupMeshOnBeforeRender();
    }
  }

  /**
   * Setup onBeforeRender callback for MaskPass context-based rendering.
   * This enables Box, Sphere, and other standard meshes to participate in mask rendering.
   */
  private setupMeshOnBeforeRender(): void {
    const raw = this.raw;
    if (!raw) return;

    // Guard: Only setup once to avoid multi-wrapping
    if (this._hasSetupOnBeforeRender) return;

    // Store original onBeforeRender in instance property for later restoration
    this._originalOnBeforeRender = raw.onBeforeRender;

    raw.onBeforeRender = (
      renderer,
      scene,
      camera,
      geometry,
      material,
      group,
    ) => {
      // Call original if exists
      if (this._originalOnBeforeRender) {
        this._originalOnBeforeRender.call(
          raw,
          renderer,
          scene,
          camera,
          geometry,
          material,
          group,
        );
      }

      // Check MaskPassContext
      const ctx = getMaskPassContext();

      if (ctx.phase !== MaskPassPhase.BaseMRT) {
        // Not in mask pass - restore normal state
        this.forEachMaterial(restoreMaterialState);
        return;
      }

      // Evaluate mask pass participation using shared helper
      const config = getSelectiveEffectConfig(raw);
      const registry = ctx.registry ?? this.view.selectiveEffectRegistry;
      const evaluation = evaluateMaskPassParticipation(
        config,
        registry,
        this.id,
        ctx,
      );

      // Apply appropriate render state
      if (evaluation.shouldRender) {
        this.forEachMaterial((m) =>
          applyMaskPassRenderState(m, evaluation.isSilhouette),
        );
      } else {
        this.forEachMaterial(applyMaskPassSkipState);
      }
    };

    this._hasSetupOnBeforeRender = true;
  }

  /**
   * Restore original onBeforeRender callback.
   * Called when effectIds becomes empty or on destroy.
   */
  private restoreOnBeforeRender(): void {
    const raw = this.raw;
    if (!raw || !this._hasSetupOnBeforeRender) return;

    // Restore material state before removing callback
    this.forEachMaterial(restoreMaterialState);

    // Restore original onBeforeRender or noop (Three.js expects function)
    raw.onBeforeRender = this._originalOnBeforeRender ?? (() => {});
    this._originalOnBeforeRender = undefined;
    this._hasSetupOnBeforeRender = false;
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

      const hadNoEffects = prevEffectIds.length === 0;
      const nowHasEffects = this._effectIds.length > 0;

      // If transitioning from no effects to having effects, set up the callback
      if (hadNoEffects && nowHasEffects) {
        this.setupMeshOnBeforeRender();
      }

      // If transitioning from having effects to no effects, restore original callback
      if (!hadNoEffects && !nowHasEffects) {
        this.restoreOnBeforeRender();
      }
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
    // Restore original onBeforeRender before destroying
    this.restoreOnBeforeRender();

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
