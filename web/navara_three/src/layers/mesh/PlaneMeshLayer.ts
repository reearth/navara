import {
  Mesh,
  MeshLambertMaterial,
  PlaneGeometry,
  type Object3DEventMap,
} from "three";

import { Color } from "../../Color";
import {
  MeshLayerDeclarationForSelectiveEffect,
  type MeshLayerConfigWithSelectiveEffect,
  type MeshLayerUpdateWithSelectiveEffect,
  type ViewContext,
  type SelectiveEffectOcclusion,
} from "../../core";
import type { CustomObject3DEventMap } from "../../object3DEvent";

type PlaneMeshEventMap = Object3DEventMap & CustomObject3DEventMap;

type LayerDescription = {
  plane?: {
    width?: number;
    height?: number;
    widthSegments?: number;
    heightSegments?: number;
    color?: Color;
    emissiveColor?: Color;
    emissiveIntensity?: number;
    opacity?: number;
    transparent?: boolean;
    castShadow?: boolean;
    receiveShadow?: boolean;
    effectIds?: string[];
    selectiveEffectOcclusion?: SelectiveEffectOcclusion;
  };
};

export type PlaneMeshLayerConfig = MeshLayerConfigWithSelectiveEffect &
  LayerDescription;

export type PlaneMeshLayerUpdate = MeshLayerUpdateWithSelectiveEffect &
  LayerDescription;

export class PlaneMeshLayer extends MeshLayerDeclarationForSelectiveEffect<
  PlaneMeshLayerConfig,
  PlaneMeshLayerUpdate,
  Mesh<PlaneGeometry, MeshLambertMaterial, PlaneMeshEventMap>
> {
  private config: PlaneMeshLayerConfig;

  constructor(view: ViewContext, config: PlaneMeshLayerConfig) {
    // Propagate initial effectIds/selectiveEffectOcclusion to base MeshLayer
    if (config.plane?.effectIds) {
      config.effectIds = config.plane.effectIds;
    }
    if (config.plane?.selectiveEffectOcclusion !== undefined) {
      config.selectiveEffectOcclusion = config.plane.selectiveEffectOcclusion;
    }
    super(view, config);
    this.config = config;
  }

  createMesh() {
    const cfg = this.config.plane;
    if (!cfg) {
      throw new Error("PlaneMesh configuration is required");
    }

    // Create geometry from parameters
    const geometry = new PlaneGeometry(
      cfg.width ?? 1,
      cfg.height ?? 1,
      cfg.widthSegments ?? 1,
      cfg.heightSegments ?? 1,
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

    const mesh = new Mesh<
      PlaneGeometry,
      MeshLambertMaterial,
      PlaneMeshEventMap
    >(geometry, material);

    mesh.castShadow = cfg.castShadow ?? false;
    mesh.receiveShadow = cfg.receiveShadow ?? false;

    this.view.emit("_csmMounted", material);

    return mesh;
  }

  onUpdateConfig(updates: PlaneMeshLayerUpdate): void {
    if (updates.plane && this._instance) {
      const cfg = updates.plane;
      const origin = this.config.plane;

      // Update geometry if dimensions changed
      if (
        cfg.width !== undefined ||
        cfg.height !== undefined ||
        cfg.widthSegments !== undefined ||
        cfg.heightSegments !== undefined
      ) {
        this._instance.geometry.dispose();
        this._instance.geometry = new PlaneGeometry(
          cfg.width ?? origin?.width ?? 1,
          cfg.height ?? origin?.height ?? 1,
          cfg.widthSegments ?? origin?.widthSegments ?? 1,
          cfg.heightSegments ?? origin?.heightSegments ?? 1,
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

      // Propagate effectIds/selectiveEffectOcclusion to base MeshLayer
      if (cfg.effectIds !== undefined) {
        updates.effectIds = cfg.effectIds;
      }
      if (cfg.selectiveEffectOcclusion !== undefined) {
        updates.selectiveEffectOcclusion = cfg.selectiveEffectOcclusion;
      }

      this.emit("_needsUpdate");
    }

    super.onUpdateConfig(updates);
  }

  protected disposeMesh(): void {
    if (this._instance) {
      this.view.emit("_csmUnmounted", this._instance.material);
      this._instance.geometry.dispose();
      this._instance.material.dispose();

      this._instance = undefined;
    }
  }
}
