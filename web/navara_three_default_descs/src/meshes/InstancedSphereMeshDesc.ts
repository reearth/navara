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
  SphereGeometry,
  Vector3,
} from "three";

const _tempColor = new ThreeColor();

/** Per-instance configuration for a single sphere. */
export type SphereChildConfig = InstancedChildConfig & {
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

export type InstancedSphereMeshConfig = InstancedMeshConfig &
  Description & { pickable?: boolean };

export type InstancedSphereMeshUpdate = InstancedMeshUpdate & Description;

export class InstancedSphereMeshDesc extends InstancedMeshDesc<
  SphereGeometry,
  MeshLambertMaterial,
  InstancedSphereMeshConfig,
  InstancedSphereMeshUpdate,
  SphereChildConfig
> {
  private config: InstancedSphereMeshConfig;
  private pickWrapper?: PickableInstancedMeshWrapper;

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
  }

  get batchIds(): readonly number[] {
    return this.pickWrapper?.batchIds ?? [];
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

  protected createMaterial(): MeshLambertMaterial {
    const cfg = this.spheresConfig;
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
    newMesh: ThreeInstancedMesh<SphereGeometry, MeshLambertMaterial>,
  ): void {
    this.pickWrapper?.syncMesh(newMesh);
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

      this.config.spheres = {
        ...this.config.spheres,
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
