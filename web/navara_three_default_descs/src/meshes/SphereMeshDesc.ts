import type ThreeView from "@navara/three";
import {
  Color,
  NewMeshDesc,
  type MeshDescConfig,
  type MeshDescUpdate,
  type ViewContext,
  type CustomObject3DEventMap,
} from "@navara/three";
import { Mesh, SphereGeometry, type Object3DEventMap } from "three";
import { MeshLambertNodeMaterial } from "three/webgpu";

type SphereMeshEventMap = Object3DEventMap & CustomObject3DEventMap;

type Description = {
  sphere?: {
    radius?: number;
    widthSegments?: number;
    heightSegments?: number;
    phiStart?: number;
    phiLength?: number;
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

export type SphereMeshConfig = MeshDescConfig & Description;

export type SphereMeshUpdate = MeshDescUpdate & Description;

export class SphereMeshDesc extends NewMeshDesc<
  SphereMeshConfig,
  SphereMeshUpdate,
  Mesh<SphereGeometry, MeshLambertNodeMaterial, SphereMeshEventMap>
> {
  private config: SphereMeshConfig;

  constructor(view: ThreeView, ctx: ViewContext, config: SphereMeshConfig) {
    // Propagate initial effectIds to MeshDescBase
    if (config.sphere?.effectIds) {
      config.effectIds = config.sphere.effectIds;
    }
    super(view, ctx, config);
    this.config = config;

    // Drive the MRT emissive uniforms from this sphere's config.
    if (config.sphere?.emissiveColor !== undefined) {
      this.emissive = config.sphere.emissiveColor;
    }
    if (config.sphere?.emissiveIntensity !== undefined) {
      this.emissiveIntensity = config.sphere.emissiveIntensity;
    }
  }

  createMesh() {
    const cfg = this.config.sphere;
    if (!cfg) {
      throw new Error("SphereMesh configuration is required");
    }

    const geometry = new SphereGeometry(
      cfg.radius ?? 1,
      cfg.widthSegments ?? 32,
      cfg.heightSegments ?? 16,
      cfg.phiStart ?? 0,
      cfg.phiLength ?? Math.PI * 2,
      cfg.thetaStart ?? 0,
      cfg.thetaLength ?? Math.PI,
    );

    const colorValue = cfg.color ?? new Color().setStyle("#ffffff");
    const material = new MeshLambertNodeMaterial({
      color: colorValue.raw,
      opacity: cfg.opacity ?? 1,
      transparent: cfg.transparent ?? false,
    });
    material.emissive.set(cfg.emissiveColor?.raw ?? 0x000000);
    material.emissiveIntensity = cfg.emissiveIntensity ?? 0;

    const mesh = new Mesh<
      SphereGeometry,
      MeshLambertNodeMaterial,
      SphereMeshEventMap
    >(geometry, material);

    mesh.castShadow = cfg.castShadow ?? false;
    mesh.receiveShadow = cfg.receiveShadow ?? false;

    this.ctx.applyShadowMaterial(material);

    return mesh;
  }

  onUpdateConfig(updates: SphereMeshUpdate): void {
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
