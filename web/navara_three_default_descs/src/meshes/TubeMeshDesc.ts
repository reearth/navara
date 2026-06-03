import type ThreeView from "@navara/three";
import {
  type XYZ,
  Color,
  NewMeshDesc,
  type MeshDescConfig,
  type MeshDescUpdate,
  type ViewContext,
  type CustomObject3DEventMap,
} from "@navara/three";
import {
  CatmullRomCurve3,
  Mesh,
  TubeGeometry,
  Vector3,
  type Object3DEventMap,
} from "three";
import { MeshLambertNodeMaterial } from "three/webgpu";

type TubeMeshEventMap = Object3DEventMap & CustomObject3DEventMap;

type Description = {
  tube?: {
    points?: XYZ[];
    tubularSegments?: number;
    radius?: number;
    radialSegments?: number;
    closed?: boolean;
    tension?: number;
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

export type TubeMeshConfig = MeshDescConfig & Description;

export type TubeMeshUpdate = MeshDescUpdate & Description;

export class TubeMeshDesc extends NewMeshDesc<
  TubeMeshConfig,
  TubeMeshUpdate,
  Mesh<TubeGeometry, MeshLambertNodeMaterial, TubeMeshEventMap>
> {
  private config: TubeMeshConfig;

  constructor(view: ThreeView, ctx: ViewContext, config: TubeMeshConfig) {
    // Propagate initial effectIds to MeshDescBase
    if (config.tube?.effectIds) {
      config.effectIds = config.tube.effectIds;
    }
    super(view, ctx, config);
    this.config = config;

    // Drive the MRT emissive uniforms from this tube's config.
    if (config.tube?.emissiveColor !== undefined) {
      this.emissive = config.tube.emissiveColor;
    }
    if (config.tube?.emissiveIntensity !== undefined) {
      this.emissiveIntensity = config.tube.emissiveIntensity;
    }
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

    const colorValue = cfg.color ?? new Color().setStyle("#ffffff");
    const material = new MeshLambertNodeMaterial({
      color: colorValue.raw,
      opacity: cfg.opacity ?? 1,
      transparent: cfg.transparent ?? false,
    });
    material.emissive.set(cfg.emissiveColor?.raw ?? 0x000000);
    material.emissiveIntensity = cfg.emissiveIntensity ?? 0;

    const mesh = new Mesh<
      TubeGeometry,
      MeshLambertNodeMaterial,
      TubeMeshEventMap
    >(geometry, material);

    mesh.castShadow = cfg.castShadow ?? false;
    mesh.receiveShadow = cfg.receiveShadow ?? false;

    this.ctx.applyShadowMaterial(material);

    return mesh;
  }

  onUpdateConfig(updates: TubeMeshUpdate): void {
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
