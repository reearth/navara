import type ThreeView from "@navara/three";
import {
  Color,
  InstancedMeshDesc,
  PickableInstancedMeshWrapper,
  setupSelectiveEffectUniforms,
  type InstancedChildConfig,
  type InstancedMeshConfig,
  type InstancedMeshUpdate,
  type ViewContext,
} from "@navara/three";
import {
  Color as ThreeColor,
  InstancedMesh as ThreeInstancedMesh,
  MeshLambertMaterial,
  PlaneGeometry,
  Vector3,
} from "three";

const _tempColor = new ThreeColor();

/** Per-instance configuration for a single plane. */
export type PlaneChildConfig = InstancedChildConfig & {
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

export type InstancedPlaneMeshConfig = InstancedMeshConfig &
  Description & { pickable?: boolean };

export type InstancedPlaneMeshUpdate = InstancedMeshUpdate & Description;

export class InstancedPlaneMeshDesc extends InstancedMeshDesc<
  PlaneGeometry,
  MeshLambertMaterial,
  InstancedPlaneMeshConfig,
  InstancedPlaneMeshUpdate,
  PlaneChildConfig
> {
  private config: InstancedPlaneMeshConfig;
  private pickWrapper?: PickableInstancedMeshWrapper;

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
  }

  get batchIds(): readonly number[] {
    return this.pickWrapper?.batchIds ?? [];
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

  protected createMaterial(): MeshLambertMaterial {
    const cfg = this.planesConfig;
    const colorValue = cfg?.color ?? new Color().setStyle("#ffffff");
    const emissiveColorValue = cfg?.emissiveColor ? cfg.emissiveColor.raw : 0;

    const material = new MeshLambertMaterial({
      color: colorValue.raw,
      emissive: emissiveColorValue,
      emissiveIntensity: cfg?.emissiveIntensity ?? 0,
      opacity: cfg?.opacity ?? 1,
      transparent: cfg?.transparent ?? false,
    });
    setupSelectiveEffectUniforms(material);
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

  protected getInstanceColor(
    config: PlaneChildConfig,
  ): ThreeColor | undefined {
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

      if (this.config.pickable) {
        this.pickWrapper = new PickableInstancedMeshWrapper(
          mesh,
          this.count,
          this.ctx,
        );
        this.ctx.registerPickableMesh(this.id, this.pickWrapper);
      }
    }
  }

  protected override onInstanceAdded(_index: number): void {
    this.pickWrapper?.addInstance();
  }

  protected override onInstanceRemoved(index: number, _wasLast: boolean): void {
    this.pickWrapper?.removeInstanceAt(index);
  }

  protected override onInstancesCleared(): void {
    this.pickWrapper?.clearInstances();
  }

  protected override onInstancesReplaced(count: number): void {
    this.pickWrapper?.replaceAll(count);
  }

  protected override onInstanceMeshReplaced(
    newMesh: ThreeInstancedMesh<PlaneGeometry, MeshLambertMaterial>,
  ): void {
    this.pickWrapper?.syncMesh(newMesh);
  }

  onUpdateConfig(updates: InstancedPlaneMeshUpdate): void {
    if (updates.planes !== undefined && this.raw) {
      const u = updates.planes;

      const material = this.raw.material;
      if (u.color !== undefined) material.color.set(u.color.raw);
      if (u.emissiveColor !== undefined) material.emissive.set(u.emissiveColor.raw);
      if (u.emissiveIntensity !== undefined)
        material.emissiveIntensity = u.emissiveIntensity;
      if (u.opacity !== undefined) material.opacity = u.opacity;
      if (u.transparent !== undefined) {
        material.transparent = u.transparent;
        material.needsUpdate = true;
      }
      if (u.castShadow !== undefined) this.raw.castShadow = u.castShadow;
      if (u.receiveShadow !== undefined) this.raw.receiveShadow = u.receiveShadow;

      if (u.children !== undefined) {
        this.replaceAll(u.children);
      }

      if (u.effectIds !== undefined) {
        updates.effectIds = u.effectIds;
      }

      this.config.planes = {
        ...this.config.planes,
        ...u,
      };
    }

    super.onUpdateConfig(updates);
  }

  override onDestroy(): void {
    if (this.pickWrapper) {
      this.ctx.unregisterPickableMesh(this.id);
      this.pickWrapper = undefined;
    }
    if (this.raw) {
      this.ctx.removeShadowMaterial(this.raw.material);
    }
    super.onDestroy();
  }
}
