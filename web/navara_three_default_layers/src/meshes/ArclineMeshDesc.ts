import type ThreeView from "@navara/three";
import {
  Color,
  MeshDescWithSelectiveEffect,
  type MeshConfigWithSelectiveEffect,
  type MeshUpdateWithSelectiveEffect,
  type ViewContext,
} from "@navara/three";

import { DefaultArcLineConfig, ArcLine, type ArcLineConfig } from "./arcLine";

type Description = {
  arcLines?: Partial<ArcLineConfig> | Partial<ArcLineConfig>[];
  emissiveColor?: Color;
  emissiveIntensity?: number;
};

export type ArclineMeshConfig = MeshConfigWithSelectiveEffect & Description;

export type ArclineMeshUpdate = MeshUpdateWithSelectiveEffect & Description;

export class ArclineMeshDesc extends MeshDescWithSelectiveEffect<
  ArclineMeshConfig,
  ArclineMeshUpdate,
  ArcLine
> {
  private config: ArclineMeshConfig;

  constructor(view: ThreeView, ctx: ViewContext, config: ArclineMeshConfig) {
    super(view, ctx, config);
    this.config = config;
  }

  protected getPassKey() {
    return "mrt" as const;
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

    const arcLine = new ArcLine(lineConfig);

    // Set initial emissive values via shared uniforms
    arcLine.updateEmissive(
      this.config.emissiveColor?.toHex() ?? 0,
      this.config.emissiveIntensity ?? 0,
    );

    return arcLine;
  }

  onUpdateConfig(updates: ArclineMeshUpdate): void {
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

      this.emit("needsUpdate");
    }

    // Update emissive properties
    if (this._instance) {
      if (updates.emissiveColor !== undefined) {
        this.config.emissiveColor = updates.emissiveColor;
      }
      if (updates.emissiveIntensity !== undefined) {
        this.config.emissiveIntensity = updates.emissiveIntensity;
      }
      if (
        updates.emissiveColor !== undefined ||
        updates.emissiveIntensity !== undefined
      ) {
        this._instance.updateEmissive(
          this.config.emissiveColor?.toHex() ?? 0,
          this.config.emissiveIntensity ?? 0,
        );
      }
    }

    super.onUpdateConfig(updates);
  }

  /**
   * Override to update effectIdsMask on all ArcLine sub-meshes.
   * ArcLine is Object3D with child Meshes, so the base class's
   * single-Mesh update doesn't work.
   */
  protected override updateEffectIdsMask(): void {
    const registry = this.ctx.selectiveEffectRegistry;
    if (!registry || !this._instance) return;

    const mask =
      this._effectIds.length > 0 ? registry.computeMask(this._effectIds) : 0;
    this._instance.updateEffectIdsMask(mask);
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
}
