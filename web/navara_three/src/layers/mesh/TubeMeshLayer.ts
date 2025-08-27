import type { XYZ } from "@navara/core";
import {
  CatmullRomCurve3,
  Mesh,
  MeshLambertMaterial,
  TubeGeometry,
  Vector3,
} from "three";

import {
  MeshLayerDeclaration,
  type MeshLayerConfig,
  type ViewContext,
} from "../../core";
import type { MeshLayerUpdate } from "../../core/MeshLayerDeclaration";

type LayerDescription = {
  tube?: {
    points?: XYZ[];
    tubularSegments?: number;
    radius?: number;
    radialSegments?: number;
    closed?: boolean;
    tension?: number;
    color?: number;
    emissive?: number;
    emissiveIntensity?: number;
    opacity?: number;
    transparent?: boolean;
    castShadow?: boolean;
    receiveShadow?: boolean;
  };
};

export type TubeMeshLayerConfig = MeshLayerConfig & LayerDescription;

export type TubeMeshLayerUpdate = MeshLayerUpdate & LayerDescription;

export class TubeMeshLayer extends MeshLayerDeclaration<
  TubeMeshLayerConfig,
  TubeMeshLayerUpdate,
  Mesh<TubeGeometry, MeshLambertMaterial>
> {
  private config: TubeMeshLayerConfig;

  constructor(view: ViewContext, config: TubeMeshLayerConfig) {
    super(view, config);
    this.config = config;
  }

  createMesh() {
    const cfg = this.config.tube;
    if (!cfg) {
      throw new Error("TubeMesh configuration is required");
    }

    if (!cfg.points || cfg.points.length < 2) {
      throw new Error("TubeMesh requires points array with at least 2 points");
    }

    // Create geometry from points
    const vector3Points = cfg.points.map((p) => new Vector3(p.x, p.y, p.z));
    const curve = new CatmullRomCurve3(vector3Points);
    curve.tension = cfg.tension ?? 0.5;

    const geometry = new TubeGeometry(
      curve,
      cfg.tubularSegments ?? 64,
      cfg.radius ?? 1,
      cfg.radialSegments ?? 8,
      cfg.closed ?? false,
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

  onUpdateConfig(updates: TubeMeshLayerUpdate): void {
    if (updates.tube && this._instance) {
      const cfg = updates.tube;
      const origin = this.config.tube;

      // Update geometry if points or parameters changed
      if (
        cfg.points ||
        cfg.tubularSegments !== undefined ||
        cfg.radius !== undefined ||
        cfg.radialSegments !== undefined ||
        cfg.closed !== undefined ||
        cfg.tension !== undefined
      ) {
        let curve: CatmullRomCurve3;
        if (cfg.points && cfg.points.length >= 2) {
          this._instance.geometry.dispose();

          const vector3Points = cfg.points.map(
            (p) => new Vector3(p.x, p.y, p.z),
          );
          curve = new CatmullRomCurve3(vector3Points);
          curve.tension = cfg.tension ?? 0.5;
        } else {
          curve = this._instance.geometry.parameters.path as CatmullRomCurve3;
          curve.tension = cfg.tension ?? curve.tension;
        }

        this._instance.geometry = new TubeGeometry(
          curve,
          cfg.tubularSegments ?? origin?.tubularSegments,
          cfg.radius ?? origin?.radius,
          cfg.radialSegments ?? origin?.radialSegments,
          cfg.closed ?? origin?.closed,
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
      this._instance.geometry.dispose();
      this._instance.material.dispose();

      this._instance = undefined;
    }
  }
}
