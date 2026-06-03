import type ThreeView from "@navara/three";
import {
  Color,
  DrapedMesh,
  NewMeshDesc,
  type MeshDescConfig,
  type MeshDescUpdate,
  type ViewContext,
  type CustomObject3DEventMap,
  type PassKey,
} from "@navara/three";
import { CylinderGeometry, type Object3DEventMap } from "three";
import { MeshBasicNodeMaterial, MeshLambertNodeMaterial } from "three/webgpu";

type CylinderMeshEventMap = Object3DEventMap & CustomObject3DEventMap;

type Description = {
  cylinder?: {
    radiusTop?: number;
    radiusBottom?: number;
    height?: number;
    radialSegments?: number;
    heightSegments?: number;
    openEnded?: boolean;
    thetaStart?: number;
    thetaLength?: number;
    color?: Color;
    emissiveColor?: Color;
    emissiveIntensity?: number;
    opacity?: number;
    transparent?: boolean;
    castShadow?: boolean;
    receiveShadow?: boolean;
    effectIds?: string[];
    /**
     * To drape the mesh properly on the terrain,
     * the mesh must cover the terrain.
     */
    draped?: boolean;
  };
};

export type CylinderMeshConfig = MeshDescConfig & Description;

export type CylinderMeshUpdate = MeshDescUpdate & Description;

type CylinderMeshMaterial = MeshLambertNodeMaterial | MeshBasicNodeMaterial;

export class CylinderMeshDesc extends NewMeshDesc<
  CylinderMeshConfig,
  CylinderMeshUpdate,
  DrapedMesh<CylinderGeometry, CylinderMeshMaterial, CylinderMeshEventMap>
> {
  private config: CylinderMeshConfig;

  constructor(view: ThreeView, ctx: ViewContext, config: CylinderMeshConfig) {
    // Propagate initial effectIds to MeshDescBase
    if (config.cylinder?.effectIds) {
      config.effectIds = config.cylinder.effectIds;
    }
    super(view, ctx, config);
    this.config = config;

    // Drive the MRT emissive uniforms from this cylinder's config.
    if (config.cylinder?.emissiveColor !== undefined) {
      this.emissive = config.cylinder.emissiveColor;
    }
    if (config.cylinder?.emissiveIntensity !== undefined) {
      this.emissiveIntensity = config.cylinder.emissiveIntensity;
    }
  }

  createMesh() {
    const cfg = this.config.cylinder;
    if (!cfg) {
      throw new Error("Cylinder configuration is required");
    }

    const geometry = new CylinderGeometry(
      cfg.radiusTop ?? 1,
      cfg.radiusBottom ?? 1,
      cfg.height ?? 1,
      cfg.radialSegments ?? 32,
      cfg.heightSegments ?? 1,
      cfg.openEnded ?? false,
      cfg.thetaStart ?? 0,
      cfg.thetaLength ?? Math.PI * 2,
    );

    const material = this.createMaterial(cfg);

    const mesh = new DrapedMesh<
      CylinderGeometry,
      CylinderMeshMaterial,
      CylinderMeshEventMap
    >(geometry, material, cfg.draped ?? false);

    mesh.castShadow = cfg.castShadow ?? false;
    mesh.receiveShadow = cfg.receiveShadow ?? false;

    this.ctx.applyShadowMaterial(material);

    return mesh;
  }

  private createMaterial(
    cfg: NonNullable<CylinderMeshConfig["cylinder"]>,
  ): CylinderMeshMaterial {
    const colorValue = cfg.color ?? new Color().setStyle("#ffffff");
    const baseParams = {
      color: colorValue.raw,
      opacity: cfg.opacity ?? 1,
      transparent: cfg.transparent ?? false,
    };

    if (cfg.draped) {
      return new MeshBasicNodeMaterial(baseParams);
    }

    const material = new MeshLambertNodeMaterial(baseParams);
    material.emissive.set(cfg.emissiveColor?.raw ?? 0x000000);
    material.emissiveIntensity = cfg.emissiveIntensity ?? 0;
    return material;
  }

  protected override getPassKey(): PassKey {
    if (this.config.cylinder?.draped) {
      return "draped";
    }
    return super.getPassKey();
  }

  onUpdateConfig(updates: CylinderMeshUpdate): void {
    if (updates.cylinder && this._instance) {
      const cfg = updates.cylinder;
      const origin = this.config.cylinder;

      // Handle draped change BEFORE super.onUpdateConfig() so getPassKey() returns correct value
      if (cfg.draped !== undefined && origin) {
        const wasChanged = origin.draped !== cfg.draped;
        origin.draped = cfg.draped;
        this._instance.drapedEnable = cfg.draped;

        // Swap material between lit and unlit
        if (wasChanged) {
          this.ctx.removeShadowMaterial(this._instance.material);
          this._instance.material.dispose();
          const newMaterial = this.createMaterial(origin);
          this._instance.material = newMaterial;
          // Pickable handle is preserved across draped swaps; re-run the
          // NodeMaterial setup against the freshly-created material.
          this.refreshNodeMaterial();
          if (!cfg.draped) {
            this.ctx.applyShadowMaterial(newMaterial);
          }
        }
      }

      // Update geometry if dimensions changed
      if (
        cfg.radiusTop !== undefined ||
        cfg.radiusBottom !== undefined ||
        cfg.height !== undefined ||
        cfg.radialSegments !== undefined ||
        cfg.heightSegments !== undefined ||
        cfg.openEnded !== undefined ||
        cfg.thetaStart !== undefined ||
        cfg.thetaLength !== undefined
      ) {
        this._instance.geometry.dispose();
        this._instance.geometry = new CylinderGeometry(
          cfg.radiusTop ?? origin?.radiusTop ?? 1,
          cfg.radiusBottom ?? origin?.radiusBottom ?? 1,
          cfg.height ?? origin?.height ?? 1,
          cfg.radialSegments ?? origin?.radialSegments ?? 32,
          cfg.heightSegments ?? origin?.heightSegments ?? 1,
          cfg.openEnded ?? origin?.openEnded ?? false,
          cfg.thetaStart ?? origin?.thetaStart ?? 0,
          cfg.thetaLength ?? origin?.thetaLength ?? Math.PI * 2,
        );

        // Update the stored config with the new values
        if (origin) {
          Object.assign(origin, cfg);
        }
      }

      // Update material if material properties changed
      if (
        cfg.color !== undefined ||
        cfg.opacity !== undefined ||
        cfg.transparent !== undefined
      ) {
        const material = this._instance.material;
        if (cfg.color !== undefined) {
          material.color.set(cfg.color.raw);
        }
        if (cfg.opacity !== undefined) material.opacity = cfg.opacity;
        if (cfg.transparent !== undefined)
          material.transparent = cfg.transparent;
        material.needsUpdate = true;
      }

      if (cfg.castShadow !== undefined) {
        this._instance.castShadow = cfg.castShadow;
      }

      if (cfg.receiveShadow !== undefined) {
        this._instance.receiveShadow = cfg.receiveShadow;
      }

      // Propagate effectIds to base MeshDesc
      if (cfg.effectIds !== undefined) {
        updates.effectIds = cfg.effectIds;
      }
      if (cfg.emissiveColor !== undefined) {
        this.emissive = cfg.emissiveColor;
      }
      if (cfg.emissiveIntensity !== undefined) {
        this.emissiveIntensity = cfg.emissiveIntensity;
      }
      this.emit("needsUpdate");
    }

    super.onUpdateConfig(updates);
  }

  protected disposeMesh(): void {
    if (this._instance) {
      this.ctx.removeShadowMaterial(this._instance.material);
      this._instance.geometry.dispose();
      this._instance.material.dispose();
      this._instance = undefined;
    }
  }
}
