import { Mesh, ShaderMaterial, SphereGeometry } from "three";

import HaloFS from "@shaders/glsl/halo.frag.glsl";
import HaloVS from "@shaders/glsl/halo.vert.glsl";

import {
  MeshLayerDeclaration,
  type MeshLayerConfig,
  type ViewContext,
} from "../../core";
import type { MeshLayerUpdate } from "../../core/MeshLayerDeclaration";

type LayerDescription = {
  halo?: {
    radius?: number;
    widthSegments?: number;
    heightSegments?: number;
    phiStart?: number;
    phiLength?: number;
    thetaStart?: number;
    thetaLength?: number;
  };
};

export type HaloMeshLayerConfig = MeshLayerConfig & LayerDescription;

export type HaloMeshLayerUpdate = MeshLayerUpdate & LayerDescription;

export class HaloMeshLayer extends MeshLayerDeclaration<
  HaloMeshLayerConfig,
  HaloMeshLayerUpdate,
  Mesh<SphereGeometry, ShaderMaterial>
> {
  private config: HaloMeshLayerConfig;

  constructor(view: ViewContext, config: HaloMeshLayerConfig) {
    super(view, config);
    this.config = config;
  }

  createMesh() {
    const cfg = this.config.halo;
    if (!cfg) {
      throw new Error("HaloMesh configuration is required");
    }

    // Create geometry from parameters
    const geometry = new SphereGeometry(
      cfg.radius ?? 6378137 * 1.25,
      64,
      32,
      0,
      Math.PI * 2,
      0,
      Math.PI,
    );

    // Create material from properties
    const material = new ShaderMaterial();
    material.vertexShader = HaloVS;
    material.fragmentShader = HaloFS;

    return new Mesh(geometry, material);
  }

  onUpdateConfig(updates: HaloMeshLayerUpdate): void {
    if (updates.halo && this._instance) {
      const cfg = updates.halo;
      const origin = this.config.halo;

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
