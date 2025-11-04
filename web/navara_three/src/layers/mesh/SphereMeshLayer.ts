import { Mesh, MeshLambertMaterial, SphereGeometry } from "three";

import {
  MeshLayerDeclaration,
  type MeshLayerConfig,
  type ViewContext,
} from "../../core";
import type { MeshLayerUpdate } from "../../core/MeshLayerDeclaration";

type LayerDescription = {
  sphere?: {
    radius?: number;
    widthSegments?: number;
    heightSegments?: number;
    phiStart?: number;
    phiLength?: number;
    thetaStart?: number;
    thetaLength?: number;
    color?: number;
    emissive?: number;
    emissiveIntensity?: number;
    opacity?: number;
    transparent?: boolean;
    castShadow?: boolean;
    receiveShadow?: boolean;
  };
};

export type SphereMeshLayerConfig = MeshLayerConfig & LayerDescription;

export type SphereMeshLayerUpdate = MeshLayerUpdate & LayerDescription;

export class SphereMeshLayer extends MeshLayerDeclaration<
  SphereMeshLayerConfig,
  SphereMeshLayerUpdate,
  Mesh<SphereGeometry, MeshLambertMaterial>
> {
  private config: SphereMeshLayerConfig;

  constructor(view: ViewContext, config: SphereMeshLayerConfig) {
    super(view, config);
    this.config = config;
  }

  createMesh() {
    const cfg = this.config.sphere;
    if (!cfg) {
      throw new Error("SphereMesh configuration is required");
    }

    // Create geometry from parameters
    const geometry = new SphereGeometry(
      cfg.radius ?? 1,
      cfg.widthSegments ?? 32,
      cfg.heightSegments ?? 16,
      cfg.phiStart ?? 0,
      cfg.phiLength ?? Math.PI * 2,
      cfg.thetaStart ?? 0,
      cfg.thetaLength ?? Math.PI,
    );

    // Create material from properties
    // If emissive is not specified, use color as emissive (for bloom effects)
    const material = new MeshLambertMaterial({
      color: cfg.color ?? 0xffffff,
      emissive: cfg.emissive ?? cfg.color ?? 0,
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

  onUpdateConfig(updates: SphereMeshLayerUpdate): void {
    if (updates.sphere && this._instance) {
      const cfg = updates.sphere;
      const origin = this.config.sphere;

      // Update geometry if dimensions changed
      if (
        cfg.radius !== undefined ||
        cfg.widthSegments !== undefined ||
        cfg.heightSegments !== undefined ||
        cfg.phiStart !== undefined ||
        cfg.phiLength !== undefined ||
        cfg.thetaStart !== undefined ||
        cfg.thetaLength !== undefined
      ) {
        this._instance.geometry.dispose();
        this._instance.geometry = new SphereGeometry(
          cfg.radius ?? origin?.radius,
          cfg.widthSegments ?? origin?.widthSegments,
          cfg.heightSegments ?? origin?.heightSegments,
          cfg.phiStart ?? origin?.phiStart,
          cfg.phiLength ?? origin?.phiLength,
          cfg.thetaStart ?? origin?.thetaStart,
          cfg.thetaLength ?? origin?.thetaLength,
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
        if (cfg.color !== undefined) material.color.set(cfg.color);
        if (cfg.emissive !== undefined) material.emissive.set(cfg.emissive);
        if (cfg.emissiveIntensity !== undefined)
          material.emissiveIntensity = cfg.emissiveIntensity;
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
