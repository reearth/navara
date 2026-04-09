import {
  type XYZ,
  Color,
  MeshLayerDeclarationWithSelectiveEffect,
  type MeshLayerConfigWithSelectiveEffect,
  type MeshLayerUpdateWithSelectiveEffect,
  type ViewContext,
  type CustomObject3DEventMap,
  setupSelectiveEffectUniforms,
} from "@navara/three";
import {
  CatmullRomCurve3,
  Mesh,
  MeshLambertMaterial,
  TubeGeometry,
  Vector3,
  type Object3DEventMap,
} from "three";

type TubeMeshEventMap = Object3DEventMap & CustomObject3DEventMap;

type LayerDescription = {
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

export type TubeMeshLayerConfig = MeshLayerConfigWithSelectiveEffect &
  LayerDescription;

export type TubeMeshLayerUpdate = MeshLayerUpdateWithSelectiveEffect &
  LayerDescription;

export class TubeMeshLayer extends MeshLayerDeclarationWithSelectiveEffect<
  TubeMeshLayerConfig,
  TubeMeshLayerUpdate,
  Mesh<TubeGeometry, MeshLambertMaterial, TubeMeshEventMap>
> {
  private config: TubeMeshLayerConfig;

  constructor(view: ViewContext, config: TubeMeshLayerConfig) {
    // Propagate initial effectIds to base MeshLayer
    if (config.tube?.effectIds) {
      config.effectIds = config.tube.effectIds;
    }
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
    const colorValue = cfg.color ?? new Color().setStyle("#ffffff");
    const emissiveColorValue = cfg.emissiveColor ? cfg.emissiveColor.raw : 0;
    const material = new MeshLambertMaterial({
      color: colorValue.raw,
      emissive: emissiveColorValue,
      emissiveIntensity: cfg.emissiveIntensity ?? 0,
      opacity: cfg.opacity ?? 1,
      transparent: cfg.transparent ?? false,
    });

    // Set up selective effect uniforms
    setupSelectiveEffectUniforms(material);

    const mesh = new Mesh<TubeGeometry, MeshLambertMaterial, TubeMeshEventMap>(
      geometry,
      material,
    );

    mesh.castShadow = cfg.castShadow ?? false;
    mesh.receiveShadow = cfg.receiveShadow ?? false;

    this.view.applyShadowMaterial(material);

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
        cfg.emissiveColor !== undefined ||
        cfg.emissiveIntensity !== undefined ||
        cfg.opacity !== undefined ||
        cfg.transparent !== undefined
      ) {
        const material = this._instance.material;
        if (cfg.color !== undefined) {
          const colorValue = cfg.color.raw;
          material.color.set(colorValue);
        }
        if (cfg.emissiveColor !== undefined) {
          material.emissive.set(cfg.emissiveColor.raw);
        }
        if (cfg.emissiveIntensity !== undefined) {
          material.emissiveIntensity = cfg.emissiveIntensity;
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
