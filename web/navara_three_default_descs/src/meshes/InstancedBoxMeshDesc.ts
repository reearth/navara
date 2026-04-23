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
  BoxGeometry,
  Color as ThreeColor,
  InstancedMesh as ThreeInstancedMesh,
  MeshLambertMaterial,
  Vector3,
} from "three";

const _tempColor = new ThreeColor();

/** Per-instance configuration for a single box. */
export type BoxChildConfig = InstancedChildConfig & {
  /** Box width (X-axis). Encoded as scale in the instance matrix. */
  width?: number;
  /** Box height (Y-axis). Encoded as scale in the instance matrix. */
  height?: number;
  /** Box depth (Z-axis). Encoded as scale in the instance matrix. */
  depth?: number;
  /** Per-instance color. */
  color?: Color;
};

/** Shared material-level properties for all instances. */
export type SharedBoxMaterialConfig = {
  color?: Color;
  emissiveColor?: Color;
  emissiveIntensity?: number;
  opacity?: number;
  transparent?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  effectIds?: string[];
};

/** The `boxes` config object containing shared material props and children. */
export type BoxesDescription = SharedBoxMaterialConfig & {
  children?: BoxChildConfig[];
};

type Description = {
  boxes?: BoxesDescription;
};

export type InstancedBoxMeshConfig = InstancedMeshConfig &
  Description & { pickable?: boolean };

export type InstancedBoxMeshUpdate = InstancedMeshUpdate & Description;

export class InstancedBoxMeshDesc extends InstancedMeshDesc<
  BoxGeometry,
  MeshLambertMaterial,
  InstancedBoxMeshConfig,
  InstancedBoxMeshUpdate,
  BoxChildConfig
> {
  private config: InstancedBoxMeshConfig;
  private pickWrapper?: PickableInstancedMeshWrapper;

  constructor(
    view: ThreeView,
    ctx: ViewContext,
    config: InstancedBoxMeshConfig,
  ) {
    // Propagate effectIds to base class
    if (config.boxes?.effectIds) {
      config.effectIds = config.boxes.effectIds;
    }
    super(view, ctx, config);
    this.config = config;
  }

  /** Per-instance batch IDs when picking is enabled. */
  get batchIds(): readonly number[] {
    return this.pickWrapper?.batchIds ?? [];
  }

  private get boxesConfig(): BoxesDescription | undefined {
    return this.config.boxes;
  }

  protected getChildConfigs(): BoxChildConfig[] {
    return this.boxesConfig?.children ?? [];
  }

  protected createGeometry(): BoxGeometry {
    // Unit box — per-instance dimensions are encoded as scale in instanceMatrix
    return new BoxGeometry(1, 1, 1);
  }

  protected createMaterial(): MeshLambertMaterial {
    const cfg = this.boxesConfig;
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
    config: BoxChildConfig,
    target: Vector3,
  ): void {
    const s = config.scale;
    target.set(
      (config.width ?? 1) * (s?.x ?? 1),
      (config.height ?? 1) * (s?.y ?? 1),
      (config.depth ?? 1) * (s?.z ?? 1),
    );
  }

  protected getInstanceColor(config: BoxChildConfig): ThreeColor | undefined {
    if (!config.color) return undefined;
    return _tempColor.set(config.color.raw);
  }

  override onCreate(): void {
    super.onCreate();

    const mesh = this.raw;
    const cfg = this.boxesConfig;
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
    newMesh: ThreeInstancedMesh<BoxGeometry, MeshLambertMaterial>,
  ): void {
    this.pickWrapper?.syncMesh(newMesh);
  }

  onUpdateConfig(updates: InstancedBoxMeshUpdate): void {
    if (updates.boxes !== undefined && this.raw) {
      const boxesUpdate = updates.boxes;

      // Update shared material properties
      const material = this.raw.material;
      if (boxesUpdate.color !== undefined) {
        material.color.set(boxesUpdate.color.raw);
      }
      if (boxesUpdate.emissiveColor !== undefined) {
        material.emissive.set(boxesUpdate.emissiveColor.raw);
      }
      if (boxesUpdate.emissiveIntensity !== undefined) {
        material.emissiveIntensity = boxesUpdate.emissiveIntensity;
      }
      if (boxesUpdate.opacity !== undefined) {
        material.opacity = boxesUpdate.opacity;
      }
      if (boxesUpdate.transparent !== undefined) {
        material.transparent = boxesUpdate.transparent;
        material.needsUpdate = true;
      }
      if (boxesUpdate.castShadow !== undefined) {
        this.raw.castShadow = boxesUpdate.castShadow;
      }
      if (boxesUpdate.receiveShadow !== undefined) {
        this.raw.receiveShadow = boxesUpdate.receiveShadow;
      }

      // Replace all instances if children provided
      if (boxesUpdate.children !== undefined) {
        this.replaceAll(boxesUpdate.children);
      }

      // Propagate effectIds to base class
      if (boxesUpdate.effectIds !== undefined) {
        updates.effectIds = boxesUpdate.effectIds;
      }

      // Update stored config
      this.config.boxes = {
        ...this.config.boxes,
        ...boxesUpdate,
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
