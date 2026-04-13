import {
  Color,
  MeshDeclarationForSelectiveEffect,
  type MeshConfigWithSelectiveEffect,
  type MeshUpdateWithSelectiveEffect,
  type ViewContext,
  type CustomObject3DEventMap,
  setupSelectiveEffectUniforms,
} from "@navara/three";
import {
  Mesh,
  MeshLambertMaterial,
  SphereGeometry,
  type Object3DEventMap,
} from "three";

type SphereMeshEventMap = Object3DEventMap & CustomObject3DEventMap;

type LayerDescription = {
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

export type SphereMeshConfig = MeshConfigWithSelectiveEffect &
  LayerDescription;

export type SphereMeshUpdate = MeshUpdateWithSelectiveEffect &
  LayerDescription;

export class SphereMeshDeclaration extends MeshDeclarationForSelectiveEffect<
  SphereMeshConfig,
  SphereMeshUpdate,
  Mesh<SphereGeometry, MeshLambertMaterial, SphereMeshEventMap>
> {
  private config: SphereMeshConfig;

  constructor(view: ViewContext, config: SphereMeshConfig) {
    // Propagate initial effectIds/selectiveEffectOcclusion to base MeshLayer
    if (config.sphere?.effectIds) {
      config.effectIds = config.sphere.effectIds;
    }
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
    const colorValue = cfg.color ?? new Color().setStyle("#ffffff");
    const material = new MeshLambertMaterial({
      color: colorValue.raw,
      opacity: cfg.opacity ?? 1,
      transparent: cfg.transparent ?? false,
    });

    // Set up selective effect uniforms and emissive properties
    material.emissive.set(cfg.emissiveColor?.raw ?? 0x000000);
    material.emissiveIntensity = cfg.emissiveIntensity ?? 0;
    setupSelectiveEffectUniforms(material);

    const mesh = new Mesh<
      SphereGeometry,
      MeshLambertMaterial,
      SphereMeshEventMap
    >(geometry, material);

    mesh.castShadow = cfg.castShadow ?? false;
    mesh.receiveShadow = cfg.receiveShadow ?? false;

    this.view.applyShadowMaterial(material);

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
