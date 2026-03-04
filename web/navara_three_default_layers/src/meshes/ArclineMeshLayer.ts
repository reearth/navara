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

  /**
   * Override onCreate to inject selective effect handlers on sub-meshes.
   * ArcLine is an Object3D containing Mesh children — onBeforeRender is only
   * called on Mesh instances, so the base class's setupMeshOnBeforeRender
   * (which targets the top-level Object3D) is insufficient.
   */
  override onCreate() {
    super.onCreate();

    if (this._instance && this.config.effectIds?.length) {
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
      this._instance.updateConfig(updateConfigs);

      // Re-inject handlers on sub-meshes (updateConfig may rebuild them)
      if (this.config.effectIds?.length) {
        this.injectHandlersOnSubMeshes();
      }

      this.emit("_needsUpdate");
    }

    // Detect effectIds transition for sub-mesh handler injection
    const prevEffectIds = this.config.effectIds ?? [];

    // super.onUpdateConfig handles _effectIds, registry links, and setupMeshOnBeforeRender
    super.onUpdateConfig(updates);

    // Synchronize config.effectIds so arcLines update path uses the correct value
    if (updates.effectIds !== undefined) {
      this.config.effectIds = updates.effectIds;

      const hadNoEffects = prevEffectIds.length === 0;
      const nowHasEffects = (updates.effectIds?.length ?? 0) > 0;

      // Base class calls setupMeshOnBeforeRender for top-level Object3D,
      // but ArcLine needs per-child Mesh injection
      if (hadNoEffects && nowHasEffects && this._instance) {
        this.injectHandlersOnSubMeshes();
      }
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
