import {
  BoxGeometry,
  Mesh,
  MeshLambertMaterial,
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

type BoxMeshEventMap = Object3DEventMap & CustomObject3DEventMap;

type LayerDescription = {
  box?: {
    width?: number;
    height?: number;
    depth?: number;
    widthSegments?: number;
    heightSegments?: number;
    depthSegments?: number;
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

export type BoxMeshLayerConfig = MeshLayerConfigWithSelectiveEffect &
  LayerDescription;

export type BoxMeshLayerUpdate = MeshLayerUpdateWithSelectiveEffect &
  LayerDescription;

export class BoxMeshLayer extends MeshLayerDeclarationForSelectiveEffect<
  BoxMeshLayerConfig,
  BoxMeshLayerUpdate,
  Mesh<BoxGeometry, MeshLambertMaterial, BoxMeshEventMap>
> {
  private config: BoxMeshLayerConfig;

  constructor(view: ViewContext, config: BoxMeshLayerConfig) {
    // Propagate initial effectIds/selectiveEffectOcclusion to base MeshLayer
    if (config.box?.effectIds) {
      config.effectIds = config.box.effectIds;
    }
    if (config.box?.selectiveEffectOcclusion !== undefined) {
      config.selectiveEffectOcclusion = config.box.selectiveEffectOcclusion;
    }
    super(view, config);
    this.config = config;
  }

  createMesh() {
    const cfg = this.config.box;
    if (!cfg) {
      throw new Error("BoxMesh configuration is required");
    }

    // Create geometry from parameters
    const geometry = new BoxGeometry(
      cfg.width ?? 1,
      cfg.height ?? 1,
      cfg.depth ?? 1,
      cfg.widthSegments ?? 1,
      cfg.heightSegments ?? 1,
      cfg.depthSegments ?? 1,
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

    const mesh = new Mesh<BoxGeometry, MeshLambertMaterial, BoxMeshEventMap>(
      geometry,
      material,
    );

    mesh.castShadow = cfg.castShadow ?? false;
    mesh.receiveShadow = cfg.receiveShadow ?? false;

    // Emit CSM event for shadow map integration
    this.view.emit("_csmMounted", material);

    return mesh;
  }

  onUpdateConfig(updates: BoxMeshLayerUpdate): void {
    if (updates.box && this._instance) {
      const cfg = updates.box;
      const origin = this.config.box;

      // Update geometry if dimensions changed
      if (
        cfg.width !== undefined ||
        cfg.height !== undefined ||
        cfg.depth !== undefined ||
        cfg.widthSegments !== undefined ||
        cfg.heightSegments !== undefined ||
        cfg.depthSegments !== undefined
      ) {
        this._instance.geometry.dispose();
        this._instance.geometry = new BoxGeometry(
          cfg.width ?? origin?.width ?? 1,
          cfg.height ?? origin?.height ?? 1,
          cfg.depth ?? origin?.depth ?? 1,
          cfg.widthSegments ?? origin?.widthSegments ?? 1,
          cfg.heightSegments ?? origin?.heightSegments ?? 1,
          cfg.depthSegments ?? origin?.depthSegments ?? 1,
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
      // Emit CSM event for shadow map cleanup
      this.view.emit("_csmUnmounted", this._instance.material);

      this._instance.geometry.dispose();
      this._instance.material.dispose();

      this._instance = undefined;
    }
  }
}
