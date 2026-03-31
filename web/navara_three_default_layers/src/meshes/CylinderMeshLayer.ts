import {
  Color,
  MeshLayerDeclarationForSelectiveEffect,
  type MeshLayerConfigWithSelectiveEffect,
  type MeshLayerUpdateWithSelectiveEffect,
  type ViewContext,
  type CustomObject3DEventMap,
} from "@navara/three";
import {
  CylinderGeometry,
  Mesh,
  MeshLambertMaterial,
  type Object3DEventMap,
} from "three";

import {
  setupEmissiveBufferUniforms,
  syncEmissiveBufferUniforms,
} from "./emissiveBufferSetup";

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
  };
};

export type CylinderMeshLayerConfig = MeshLayerConfigWithSelectiveEffect &
  LayerDescription;

export type CylinderMeshLayerUpdate = MeshLayerUpdateWithSelectiveEffect &
  LayerDescription;

export class CylinderMeshLayer extends MeshLayerDeclarationForSelectiveEffect<
  CylinderMeshLayerConfig,
  CylinderMeshLayerUpdate,
  Mesh<CylinderGeometry, MeshLambertMaterial, CylinderMeshEventMap>
> {
  private config: CylinderMeshLayerConfig;

  constructor(view: ViewContext, config: CylinderMeshLayerConfig) {
    // Propagate initial effectIds to base MeshLayer
    if (config.cylinder?.effectIds) {
      config.effectIds = config.cylinder.effectIds;
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
    const colorValue = cfg.color ?? new Color().setStyle("#ffffff");
    const emissiveColorValue = cfg.emissiveColor ? cfg.emissiveColor.raw : 0;
    const material = new MeshLambertMaterial({
      color: colorValue.raw,
      emissive: emissiveColorValue,
      emissiveIntensity: cfg.emissiveIntensity ?? 1,
      opacity: cfg.opacity ?? 1,
      transparent: cfg.transparent ?? false,
    });

    const hexEmissiveColor = cfg.emissiveColor?.raw ?? 0x000000;
    setupEmissiveBufferUniforms(
      material,
      hexEmissiveColor,
      cfg.emissiveIntensity ?? 0,
    );

    const mesh = new Mesh<
      CylinderGeometry,
      MeshLambertMaterial,
      CylinderMeshEventMap
    >(geometry, material);

    mesh.castShadow = cfg.castShadow ?? false;
    mesh.receiveShadow = cfg.receiveShadow ?? false;

    this.view.applyShadowMaterial(material);

    return mesh;
  }

  onUpdateConfig(updates: CylinderMeshLayerUpdate): void {
    if (updates.cylinder && this._instance) {
      const cfg = updates.cylinder;
      const origin = this.config.cylinder;

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
        if (material instanceof MeshLambertMaterial) {
          if (cfg.color !== undefined) {
            const colorValue = cfg.color.raw;
            material.color.set(colorValue);
          }
          if (cfg.emissiveColor !== undefined)
            material.emissive.set(cfg.emissiveColor.raw);
          if (cfg.emissiveIntensity !== undefined)
            material.emissiveIntensity = cfg.emissiveIntensity;
          syncEmissiveBufferUniforms(
            material,
            cfg.emissiveColor?.raw,
            cfg.emissiveIntensity,
          );
          if (cfg.opacity !== undefined) material.opacity = cfg.opacity;
          if (cfg.transparent !== undefined)
            material.transparent = cfg.transparent;
          material.needsUpdate = true;
        }
      }

      if (cfg.castShadow !== undefined) {
        this._instance.castShadow = cfg.castShadow;
      }

      if (cfg.receiveShadow !== undefined) {
        this._instance.receiveShadow = cfg.receiveShadow;
      }

      // Propagate effectIds to base MeshLayer
      if (cfg.effectIds !== undefined) {
        updates.effectIds = cfg.effectIds;
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
