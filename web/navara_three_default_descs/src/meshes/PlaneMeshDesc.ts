import type ThreeView from "@navara/three";
import {
  Color,
  NewMeshDesc,
  type MeshDescConfig,
  type MeshDescUpdate,
  type ViewContext,
  type CustomObject3DEventMap,
} from "@navara/three";
import { Mesh, PlaneGeometry, type Object3DEventMap } from "three";
import { MeshLambertNodeMaterial } from "three/webgpu";

type PlaneMeshEventMap = Object3DEventMap & CustomObject3DEventMap;

type Description = {
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
  };
};

export type PlaneMeshConfig = MeshDescConfig & Description;

export type PlaneMeshUpdate = MeshDescUpdate & Description;

export class PlaneMeshDesc extends NewMeshDesc<
  PlaneMeshConfig,
  PlaneMeshUpdate,
  Mesh<PlaneGeometry, MeshLambertNodeMaterial, PlaneMeshEventMap>
> {
  private config: PlaneMeshConfig;

  constructor(view: ThreeView, ctx: ViewContext, config: PlaneMeshConfig) {
    // Propagate initial effectIds to MeshDescBase
    if (config.plane?.effectIds) {
      config.effectIds = config.plane.effectIds;
    }
    super(view, ctx, config);
    this.config = config;

    // Drive the MRT emissive uniforms from this plane's config.
    if (config.plane?.emissiveColor !== undefined) {
      this.emissive = config.plane.emissiveColor;
    }
    if (config.plane?.emissiveIntensity !== undefined) {
      this.emissiveIntensity = config.plane.emissiveIntensity;
    }
  }

  createMesh() {
    const cfg = this.config.plane;
    if (!cfg) {
      throw new Error("PlaneMesh configuration is required");
    }

    const geometry = new PlaneGeometry(
      cfg.width ?? 1,
      cfg.height ?? 1,
      cfg.widthSegments ?? 1,
      cfg.heightSegments ?? 1,
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
      PlaneGeometry,
      MeshLambertNodeMaterial,
      PlaneMeshEventMap
    >(geometry, material);

    mesh.castShadow = cfg.castShadow ?? false;
    mesh.receiveShadow = cfg.receiveShadow ?? false;

    this.ctx.applyShadowMaterial(material);

    return mesh;
  }

  onUpdateConfig(updates: PlaneMeshUpdate): void {
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
