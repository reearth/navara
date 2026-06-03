import type ThreeView from "@navara/three";
import {
  Color,
  NewInstancedMeshDesc,
  type InstancedMeshDescChildConfig,
  type InstancedMeshDescConfig,
  type InstancedMeshDescUpdate,
  type ViewContext,
} from "@navara/three";
import { Color as ThreeColor, PlaneGeometry, Vector3 } from "three";
import { MeshLambertNodeMaterial } from "three/webgpu";

const _tempColor = new ThreeColor();

/** Per-instance configuration for a single plane. */
export type PlaneChildConfig = InstancedMeshDescChildConfig & {
  /** Plane width (X-axis). Encoded as scale in the instance matrix. */
  width?: number;
  /** Plane height (Y-axis). Encoded as scale in the instance matrix. */
  height?: number;
  /** Per-instance color. */
  color?: Color;
};

/** Shared properties for all plane instances. Segment counts are baked into the shared geometry. */
export type SharedPlaneConfig = {
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

export type PlanesDescription = SharedPlaneConfig & {
  children?: PlaneChildConfig[];
};

type Description = {
  planes?: PlanesDescription;
};

export type InstancedPlaneMeshConfig = InstancedMeshDescConfig & Description;

export type InstancedPlaneMeshUpdate = InstancedMeshDescUpdate & Description;

export class InstancedPlaneMeshDesc extends NewInstancedMeshDesc<
  PlaneGeometry,
  MeshLambertNodeMaterial,
  InstancedPlaneMeshConfig,
  InstancedPlaneMeshUpdate,
  PlaneChildConfig
> {
  private config: InstancedPlaneMeshConfig;

  constructor(
    view: ThreeView,
    ctx: ViewContext,
    config: InstancedPlaneMeshConfig,
  ) {
    if (config.planes?.effectIds) {
      config.effectIds = config.planes.effectIds;
    }
    super(view, ctx, config);
    this.config = config;

    // Drive the MRT emissive uniforms from the planes config.
    if (config.planes?.emissiveColor !== undefined) {
      this.emissive = config.planes.emissiveColor;
    }
    if (config.planes?.emissiveIntensity !== undefined) {
      this.emissiveIntensity = config.planes.emissiveIntensity;
    }
  }

  private get planesConfig(): PlanesDescription | undefined {
    return this.config.planes;
  }

  protected getChildConfigs(): PlaneChildConfig[] {
    return this.planesConfig?.children ?? [];
  }

  protected createGeometry(): PlaneGeometry {
    const cfg = this.planesConfig;
    return new PlaneGeometry(
      1,
      1,
      cfg?.widthSegments ?? 1,
      cfg?.heightSegments ?? 1,
    );
  }

  protected createMaterial(): MeshLambertNodeMaterial {
    const cfg = this.planesConfig;
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
    config: PlaneChildConfig,
    target: Vector3,
  ): void {
    const s = config.scale;
    target.set(
      (config.width ?? 1) * (s?.x ?? 1),
      (config.height ?? 1) * (s?.y ?? 1),
      s?.z ?? 1,
    );
  }

  protected getInstanceColor(config: PlaneChildConfig): ThreeColor | undefined {
    if (!config.color) return undefined;
    return _tempColor.set(config.color.raw);
  }

  override onCreate(): void {
    super.onCreate();

    const mesh = this.raw;
    const cfg = this.planesConfig;
    if (mesh) {
      mesh.castShadow = cfg?.castShadow ?? false;
      mesh.receiveShadow = cfg?.receiveShadow ?? false;
      this.ctx.applyShadowMaterial(mesh.material);
    }
  }

  onUpdateConfig(updates: InstancedPlaneMeshUpdate): void {
    if (updates.planes !== undefined && this.raw) {
      const u = updates.planes;

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

      this.config.planes = {
        ...this.config.planes,
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
