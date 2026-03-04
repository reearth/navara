import {
  MeshLayerDeclarationForSelectiveEffect,
  type MeshLayerConfigWithSelectiveEffect,
  type MeshLayerUpdateWithSelectiveEffect,
  type ViewContext,
  injectSelectiveEffectHandlers,
} from "@navara/three";
import { Mesh } from "three";

import { DefaultArcLineConfig, ArcLine, type ArcLineConfig } from "./arcLine";

type LayerDescription = {
  arcLines?: Partial<ArcLineConfig> | Partial<ArcLineConfig>[];
};

export type ArclineMeshLayerConfig = MeshLayerConfigWithSelectiveEffect &
  LayerDescription;

export type ArclineMeshLayerUpdate = MeshLayerUpdateWithSelectiveEffect &
  LayerDescription;

export class ArclineMeshLayer extends MeshLayerDeclarationForSelectiveEffect<
  ArclineMeshLayerConfig,
  ArclineMeshLayerUpdate,
  ArcLine
> {
  private config: ArclineMeshLayerConfig;

  constructor(view: ViewContext, config: ArclineMeshLayerConfig) {
    super(view, config);
    this.config = config;
  }

  protected getPassKey() {
    return "mrt" as const;
  }

  /**
   * Override onCreate to inject selective effect handlers on sub-meshes.
   * ArcLine is an Object3D containing Mesh children — onBeforeRender is only
   * called on Mesh instances, so the base class's setupMeshOnBeforeRender
   * (which targets the top-level Object3D) is insufficient.
   *
   * Handlers are injected unconditionally because ArcLine is always in the
   * MRT scene (getPassKey → "mrt"). Without handlers, sub-meshes would render
   * to mask RTs with default material state during BaseMRT passes.
   */
  override onCreate() {
    super.onCreate();

    if (this._instance) {
      this.injectHandlersOnSubMeshes();
    }
  }

  createMesh() {
    const lineConfig: Partial<ArcLineConfig>[] = [];
    if (this.config.arcLines) {
      const configs = Array.isArray(this.config.arcLines)
        ? this.config.arcLines
        : [this.config.arcLines];

      for (const cfg of configs) {
        lineConfig.push({
          thickness: cfg.thickness ?? DefaultArcLineConfig.thickness,
          transparent: cfg.transparent ?? DefaultArcLineConfig.transparent,
          opacity: cfg.opacity ?? DefaultArcLineConfig.opacity,
          segments: cfg.segments ?? DefaultArcLineConfig.segments,
          srcColor: cfg.srcColor ?? DefaultArcLineConfig.srcColor,
          tgtColor: cfg.tgtColor ?? DefaultArcLineConfig.tgtColor,
          height: cfg.height ?? DefaultArcLineConfig.height,
          arcHeightScale:
            cfg.arcHeightScale ?? DefaultArcLineConfig.arcHeightScale,
          gradation: cfg.gradation ?? DefaultArcLineConfig.gradation,
          dashed: cfg.dashed ?? DefaultArcLineConfig.dashed,
          dashSize: cfg.dashSize ?? DefaultArcLineConfig.dashSize,
          gapSize: cfg.gapSize ?? DefaultArcLineConfig.gapSize,
          dashOffset: cfg.dashOffset ?? DefaultArcLineConfig.dashOffset,
          geometry: cfg.geometry ?? DefaultArcLineConfig.geometry,
        });
      }
    }

    return new ArcLine(lineConfig);
  }

  onUpdateConfig(updates: ArclineMeshLayerUpdate): void {
    // Compute next effectIds upfront to avoid using stale this.config.effectIds
    // (super.onUpdateConfig hasn't been called yet at this point)
    const currentEffectIds = this.config.effectIds ?? [];
    const nextEffectIds =
      updates.effectIds !== undefined
        ? (updates.effectIds ?? [])
        : currentEffectIds;
    const effectIdsChanged =
      updates.effectIds !== undefined &&
      (currentEffectIds.length !== nextEffectIds.length ||
        currentEffectIds.some((id, i) => id !== nextEffectIds[i]));

    if (updates.arcLines && this._instance) {
      const updateConfigs = Array.isArray(updates.arcLines)
        ? updates.arcLines
        : [updates.arcLines];
      const currentConfigs = Array.isArray(this.config.arcLines)
        ? [...this.config.arcLines]
        : this.config.arcLines
          ? [this.config.arcLines]
          : [];

      updateConfigs.forEach((cfg, i) => {
        if (currentConfigs[i]) {
          Object.assign(currentConfigs[i], cfg);
        } else {
          currentConfigs[i] = { ...cfg };
        }
      });
      this.config.arcLines = currentConfigs;

      // Unlink old sub-meshes before potential rebuild to clear stale cache entries
      if (currentEffectIds.length > 0) {
        this.view.selectiveEffectRegistry?.updateLinksForObject(
          this._instance,
          [],
          currentEffectIds,
          this.id,
        );
      }

      this._instance.updateConfig(updateConfigs);

      // Re-link (potentially rebuilt) sub-meshes.
      // If effectIds actually changed, base class relinks after super.onUpdateConfig().
      if (!effectIdsChanged && nextEffectIds.length > 0) {
        this.view.selectiveEffectRegistry?.updateLinksForObject(
          this._instance,
          nextEffectIds,
          [],
          this.id,
        );
      }

      // Always re-inject handlers — ArcLine is always in MRT,
      // so new sub-meshes need handlers regardless of effectIds
      this.injectHandlersOnSubMeshes();

      this.emit("_needsUpdate");
    }

    // super.onUpdateConfig handles _effectIds, registry links, and setupMeshOnBeforeRender
    super.onUpdateConfig(updates);

    // Synchronize config.effectIds
    if (updates.effectIds !== undefined) {
      this.config.effectIds = [...updates.effectIds];
    }
  }

  onResize(width: number, height: number): void {
    this._instance?.onResize(width, height);
  }

  protected disposeMesh(): void {
    if (this._instance) {
      this._instance.dispose();
      this._instance = undefined;
    }
  }

  /**
   * Inject selective effect handlers on each sub-mesh of the ArcLine.
   * Uses a flag to prevent double-injection on sub-meshes that survived
   * an updateConfig rebuild.
   */
  private injectHandlersOnSubMeshes(): void {
    if (!this._instance) return;
    this._instance.traverse((child) => {
      if (child instanceof Mesh && !child.userData._selectiveEffectInjected) {
        injectSelectiveEffectHandlers(child, {
          registry: this.view.selectiveEffectRegistry,
          layerId: this.id,
        });
        child.userData._selectiveEffectInjected = true;
      }
    });
  }
}
