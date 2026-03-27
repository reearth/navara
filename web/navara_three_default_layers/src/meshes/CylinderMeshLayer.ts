import {
  Color,
  DrapedMesh,
  MeshLayerDeclarationForSelectiveEffect,
  type MeshLayerConfigWithSelectiveEffect,
  type MeshLayerUpdateWithSelectiveEffect,
  type ViewContext,
  type SelectiveEffectOcclusion,
  type CustomObject3DEventMap,
  type PassKey,
} from "@navara/three";
import {
  CylinderGeometry,
  MeshBasicMaterial,
  MeshLambertMaterial,
  type Object3DEventMap,
} from "three";

type CylinderMeshEventMap = Object3DEventMap & CustomObject3DEventMap;

type LayerDescription = {
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
    selectiveEffectOcclusion?: SelectiveEffectOcclusion;
    /**
     * To drape the mesh properly on the terrain,
     * the mesh must cover the terrain.
     */
    draped?: boolean;
  };
};

export type CylinderMeshLayerConfig = MeshLayerConfigWithSelectiveEffect &
  LayerDescription;

export type CylinderMeshLayerUpdate = MeshLayerUpdateWithSelectiveEffect &
  LayerDescription;

type CylinderMeshMaterial = MeshLambertMaterial | MeshBasicMaterial;

export class CylinderMeshLayer extends MeshLayerDeclarationForSelectiveEffect<
  CylinderMeshLayerConfig,
  CylinderMeshLayerUpdate,
  DrapedMesh<CylinderGeometry, CylinderMeshMaterial, CylinderMeshEventMap>
> {
  private config: CylinderMeshLayerConfig;

  constructor(view: ViewContext, config: CylinderMeshLayerConfig) {
    // Propagate initial effectIds/selectiveEffectOcclusion to base MeshLayer
    if (config.cylinder?.effectIds) {
      config.effectIds = config.cylinder.effectIds;
    }
    if (config.cylinder?.selectiveEffectOcclusion !== undefined) {
      config.selectiveEffectOcclusion =
        config.cylinder.selectiveEffectOcclusion;
    }
    super(view, config);
    this.config = config;
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

    // Create material from properties
    const material = this.createMaterial(cfg);

    const mesh = new DrapedMesh<
      CylinderGeometry,
      CylinderMeshMaterial,
      CylinderMeshEventMap
    >(geometry, material, cfg.draped ?? false);

    mesh.castShadow = cfg.castShadow ?? false;
    mesh.receiveShadow = cfg.receiveShadow ?? false;

    this.view.applyShadowMaterial(material);

    return mesh;
  }

  private createMaterial(
    cfg: NonNullable<CylinderMeshLayerConfig["cylinder"]>,
  ): CylinderMeshMaterial {
    const colorValue = cfg.color ?? new Color().setStyle("#ffffff");
    if (cfg.draped) {
      return new MeshBasicMaterial({
        color: colorValue.raw,
        opacity: cfg.opacity ?? 1,
        transparent: cfg.transparent ?? false,
      });
    }
    const emissiveColorValue = cfg.emissiveColor ? cfg.emissiveColor.raw : 0;
    return new MeshLambertMaterial({
      color: colorValue.raw,
      emissive: emissiveColorValue,
      emissiveIntensity: cfg.emissiveIntensity ?? 1,
      opacity: cfg.opacity ?? 1,
      transparent: cfg.transparent ?? false,
    });
  }

  protected override getPassKey(): PassKey {
    if (this.config.cylinder?.draped) {
      return "draped";
    }
    return super.getPassKey();
  }

  onUpdateConfig(updates: CylinderMeshLayerUpdate): void {
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
          this.view.removeShadowMaterial(this._instance.material);
          this._instance.material.dispose();
          const newMaterial = this.createMaterial(origin);
          this._instance.material = newMaterial;
          if (!cfg.draped) {
            this.view.applyShadowMaterial(newMaterial);
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
        cfg.emissiveColor !== undefined ||
        cfg.emissiveIntensity !== undefined ||
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
        if (material instanceof MeshLambertMaterial) {
          if (cfg.emissiveColor !== undefined)
            material.emissive.set(cfg.emissiveColor.raw);
          if (cfg.emissiveIntensity !== undefined)
            material.emissiveIntensity = cfg.emissiveIntensity;
        }
        material.needsUpdate = true;
      }

      if (cfg.castShadow !== undefined) {
        this._instance.castShadow = cfg.castShadow;
      }

      if (cfg.receiveShadow !== undefined) {
        this._instance.receiveShadow = cfg.receiveShadow;
      }

      // Propagate effectIds/selectiveEffectOcclusion to base MeshLayer
      if (cfg.effectIds !== undefined) {
        updates.effectIds = cfg.effectIds;
      }
      if (cfg.selectiveEffectOcclusion !== undefined) {
        updates.selectiveEffectOcclusion = cfg.selectiveEffectOcclusion;
      }

      this.emit("needsUpdate");
    }

    super.onUpdateConfig(updates);
  }

  protected disposeMesh(): void {
    if (this._instance) {
      this.view.removeShadowMaterial(this._instance.material);
      this._instance.geometry.dispose();
      this._instance.material.dispose();

      this._instance = undefined;
    }
  }
}
