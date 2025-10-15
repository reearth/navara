import { BoxGeometry, Mesh, MeshLambertMaterial } from "three";

import {
  MeshLayerDeclaration,
  type MeshLayerConfig,
  type MeshLayerUpdate,
  type ViewContext,
} from "../../core";

type LayerDescription = {
  box?: {
    width?: number;
    height?: number;
    depth?: number;
    widthSegments?: number;
    heightSegments?: number;
    depthSegments?: number;
    color?: number;
    emissive?: number;
    emissiveIntensity?: number;
    opacity?: number;
    transparent?: boolean;
    castShadow?: boolean;
    receiveShadow?: boolean;
  };
};

export type BoxMeshLayerConfig = MeshLayerConfig & LayerDescription;

export type BoxMeshLayerUpdate = MeshLayerUpdate & LayerDescription;

export class BoxMeshLayer extends MeshLayerDeclaration<
  BoxMeshLayerConfig,
  BoxMeshLayerUpdate,
  Mesh<BoxGeometry, MeshLambertMaterial>
> {
  private config: BoxMeshLayerConfig;

  constructor(view: ViewContext, config: BoxMeshLayerConfig) {
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
    const material = new MeshLambertMaterial({
      color: cfg.color ?? 0xffffff,
      emissive: cfg.emissive ?? 0,
      emissiveIntensity: cfg.emissiveIntensity ?? 1,
      opacity: cfg.opacity ?? 1,
      transparent: cfg.transparent ?? false,
    });

    const mesh = new Mesh(geometry, material);

    mesh.castShadow = cfg.castShadow ?? false;
    mesh.receiveShadow = cfg.receiveShadow ?? false;

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
        cfg.emissive !== undefined ||
        cfg.emissiveIntensity !== undefined ||
        cfg.opacity !== undefined ||
        cfg.transparent !== undefined
      ) {
        const material = this._instance.material;
        if (material instanceof MeshLambertMaterial) {
          if (cfg.color !== undefined) material.color.set(cfg.color);
          if (cfg.emissive !== undefined) material.emissive.set(cfg.emissive);
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
