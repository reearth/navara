import type ThreeView from "@navara/three";
import {
  Color,
  NewInstancedMeshDesc,
  type InstancedMeshDescChildConfig,
  type InstancedMeshDescConfig,
  type InstancedMeshDescUpdate,
  type ViewContext,
} from "@navara/three";
import { Color as ThreeColor, SphereGeometry, Vector3 } from "three";
import { MeshLambertNodeMaterial } from "three/webgpu";

const _tempColor = new ThreeColor();

/** Per-instance configuration for a single sphere. */
export type SphereChildConfig = InstancedMeshDescChildConfig & {
  /** Sphere radius. Encoded as uniform scale in the instance matrix. */
  radius?: number;
  /** Per-instance color. */
  color?: Color;
};

/** Shared properties for all sphere instances. Segment/arc params are baked into the shared geometry. */
export type SharedSphereConfig = {
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

export type SpheresDescription = SharedSphereConfig & {
  children?: SphereChildConfig[];
};

type Description = {
  spheres?: SpheresDescription;
};

export type InstancedSphereMeshConfig = InstancedMeshDescConfig & Description;

export type InstancedSphereMeshUpdate = InstancedMeshDescUpdate & Description;

export class InstancedSphereMeshDesc extends NewInstancedMeshDesc<
  SphereGeometry,
  MeshLambertNodeMaterial,
  InstancedSphereMeshConfig,
  InstancedSphereMeshUpdate,
  SphereChildConfig
> {
  private config: InstancedSphereMeshConfig;

  constructor(
    view: ThreeView,
    ctx: ViewContext,
    config: InstancedSphereMeshConfig,
  ) {
    if (config.spheres?.effectIds) {
      config.effectIds = config.spheres.effectIds;
    }
    super(view, ctx, config);
    this.config = config;

    // Drive the MRT emissive uniforms from the spheres config.
    if (config.spheres?.emissiveColor !== undefined) {
      this.emissive = config.spheres.emissiveColor;
    }
    if (config.spheres?.emissiveIntensity !== undefined) {
      this.emissiveIntensity = config.spheres.emissiveIntensity;
    }
  }

  private get spheresConfig(): SpheresDescription | undefined {
    return this.config.spheres;
  }

  protected getChildConfigs(): SphereChildConfig[] {
    return this.spheresConfig?.children ?? [];
  }

  protected createGeometry(): SphereGeometry {
    const cfg = this.spheresConfig;
    return new SphereGeometry(
      1,
      cfg?.widthSegments ?? 32,
      cfg?.heightSegments ?? 16,
      cfg?.phiStart ?? 0,
      cfg?.phiLength ?? Math.PI * 2,
      cfg?.thetaStart ?? 0,
      cfg?.thetaLength ?? Math.PI,
    );
  }

  protected createMaterial(): MeshLambertNodeMaterial {
    const cfg = this.spheresConfig;
    const colorValue = cfg?.color ?? new Color().setStyle("#ffffff");
    const emissiveColorValue = cfg?.emissiveColor ? cfg.emissiveColor.raw : 0;

    const material = new MeshLambertNodeMaterial({
      color: colorValue.raw,
      opacity: cfg?.opacity ?? 1,
      transparent: cfg?.transparent ?? false,
    });
    material.emissive.set(emissiveColorValue);
    material.emissiveIntensity = cfg?.emissiveIntensity ?? 0;
    return material;
  }

  protected override getInstanceScale(
    config: SphereChildConfig,
    target: Vector3,
  ): void {
    const s = config.scale;
    const r = config.radius ?? 1;
    target.set(r * (s?.x ?? 1), r * (s?.y ?? 1), r * (s?.z ?? 1));
  }

  protected getInstanceColor(
    config: SphereChildConfig,
  ): ThreeColor | undefined {
    if (!config.color) return undefined;
    return _tempColor.set(config.color.raw);
  }

  override onCreate(): void {
    super.onCreate();

    const mesh = this.raw;
    const cfg = this.spheresConfig;
    if (mesh) {
      mesh.castShadow = cfg?.castShadow ?? false;
      mesh.receiveShadow = cfg?.receiveShadow ?? false;
      this.ctx.applyShadowMaterial(mesh.material);
    }
  }

  onUpdateConfig(updates: InstancedSphereMeshUpdate): void {
    if (updates.spheres !== undefined && this.raw) {
      const u = updates.spheres;

      const material = this.raw.material;
      if (u.color !== undefined) material.color.set(u.color.raw);
      if (u.emissiveColor !== undefined)
        material.emissive.set(u.emissiveColor.raw);
      if (u.emissiveIntensity !== undefined)
        material.emissiveIntensity = u.emissiveIntensity;
      if (u.opacity !== undefined) material.opacity = u.opacity;
      if (u.transparent !== undefined) {
        material.transparent = u.transparent;
        material.needsUpdate = true;
      }
      if (u.castShadow !== undefined) this.raw.castShadow = u.castShadow;
      if (u.receiveShadow !== undefined)
        this.raw.receiveShadow = u.receiveShadow;

      if (u.children !== undefined) {
        this.replaceAll(u.children);
      }

      if (u.effectIds !== undefined) {
        updates.effectIds = u.effectIds;
      }
      if (u.emissiveColor !== undefined) {
        this.emissive = u.emissiveColor;
      }
      if (u.emissiveIntensity !== undefined) {
        this.emissiveIntensity = u.emissiveIntensity;
      }

      this.config.spheres = {
        ...this.config.spheres,
        ...u,
      };
    }

    super.onUpdateConfig(updates);
  }

  override onDestroy(): void {
    if (this.raw) {
      this.ctx.removeShadowMaterial(this.raw.material);
    }
    super.onDestroy();
  }
}
