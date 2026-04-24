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
  CylinderGeometry,
  InstancedMesh as ThreeInstancedMesh,
  MeshLambertMaterial,
  Vector3,
} from "three";

const _tempColor = new ThreeColor();

/**
 * Per-instance configuration for a single cylinder.
 *
 * `radius` is a uniform XZ scale multiplier applied to the shared geometry's
 * `radiusTop` and `radiusBottom`. `height` is a Y scale multiplier applied to
 * the shared unit-height geometry. Taper ratio, segments, caps, and arc are
 * shared across all instances.
 */
export type CylinderChildConfig = InstancedChildConfig & {
  /** Uniform radius multiplier (scales both radiusTop and radiusBottom). */
  radius?: number;
  /** Height multiplier. */
  height?: number;
  /** Per-instance color. */
  color?: Color;
};

/**
 * Shared properties for all cylinder instances. Taper, segments, caps and arc
 * are baked into the shared geometry and cannot vary per instance.
 */
export type SharedCylinderConfig = {
  radiusTop?: number;
  radiusBottom?: number;
  radialSegments?: number;
  heightSegments?: number;
  openEnded?: boolean;
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

export type CylindersDescription = SharedCylinderConfig & {
  children?: CylinderChildConfig[];
};

type Description = {
  cylinders?: CylindersDescription;
};

export type InstancedCylinderMeshConfig = InstancedMeshConfig &
  Description & { pickable?: boolean };

export type InstancedCylinderMeshUpdate = InstancedMeshUpdate & Description;

export class InstancedCylinderMeshDesc extends InstancedMeshDesc<
  CylinderGeometry,
  MeshLambertMaterial,
  InstancedCylinderMeshConfig,
  InstancedCylinderMeshUpdate,
  CylinderChildConfig
> {
  private config: InstancedCylinderMeshConfig;
  private pickWrapper?: PickableInstancedMeshWrapper;

  constructor(
    view: ThreeView,
    ctx: ViewContext,
    config: InstancedCylinderMeshConfig,
  ) {
    if (config.cylinders?.effectIds) {
      config.effectIds = config.cylinders.effectIds;
    }
    super(view, ctx, config);
    this.config = config;
  }

  get batchIds(): readonly number[] {
    return this.pickWrapper?.batchIds ?? [];
  }

  private get cylindersConfig(): CylindersDescription | undefined {
    return this.config.cylinders;
  }

  protected getChildConfigs(): CylinderChildConfig[] {
    return this.cylindersConfig?.children ?? [];
  }

  protected createGeometry(): CylinderGeometry {
    const cfg = this.cylindersConfig;
    return new CylinderGeometry(
      cfg?.radiusTop ?? 1,
      cfg?.radiusBottom ?? 1,
      1,
      cfg?.radialSegments ?? 16,
      cfg?.heightSegments ?? 1,
      cfg?.openEnded ?? false,
      cfg?.thetaStart ?? 0,
      cfg?.thetaLength ?? Math.PI * 2,
    );
  }

  protected createMaterial(): MeshLambertMaterial {
    const cfg = this.cylindersConfig;
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
    config: CylinderChildConfig,
    target: Vector3,
  ): void {
    const s = config.scale;
    const r = config.radius ?? 1;
    const h = config.height ?? 1;
    target.set(r * (s?.x ?? 1), h * (s?.y ?? 1), r * (s?.z ?? 1));
  }

  protected getInstanceColor(
    config: CylinderChildConfig,
  ): ThreeColor | undefined {
    if (!config.color) return undefined;
    return _tempColor.set(config.color.raw);
  }

  override onCreate(): void {
    super.onCreate();

    const mesh = this.raw;
    const cfg = this.cylindersConfig;
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
    newMesh: ThreeInstancedMesh<CylinderGeometry, MeshLambertMaterial>,
  ): void {
    this.pickWrapper?.syncMesh(newMesh);
  }

  onUpdateConfig(updates: InstancedCylinderMeshUpdate): void {
    if (updates.cylinders !== undefined && this.raw) {
      const u = updates.cylinders;

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

      this.config.cylinders = {
        ...this.config.cylinders,
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
