import type ThreeView from "@navara/three";
import {
  Color,
  NewInstancedMeshDesc,
  type InstancedMeshDescChildConfig,
  type InstancedMeshDescConfig,
  type InstancedMeshDescUpdate,
  type ViewContext,
} from "@navara/three";
import { BoxGeometry, Color as ThreeColor, Vector3 } from "three";
import { MeshLambertNodeMaterial } from "three/webgpu";

const _tempColor = new ThreeColor();

/** Per-instance configuration for a single box. */
export type BoxChildConfig = InstancedMeshDescChildConfig & {
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
};

/** The `boxes` config object containing shared material props and children. */
export type BoxesDescription = SharedBoxMaterialConfig & {
  children?: BoxChildConfig[];
};

type Description = {
  boxes?: BoxesDescription;
};

export type InstancedBoxMeshConfig = InstancedMeshDescConfig & Description;

export type InstancedBoxMeshUpdate = InstancedMeshDescUpdate & Description;

export class InstancedBoxMeshDesc extends NewInstancedMeshDesc<
  BoxGeometry,
  MeshLambertNodeMaterial,
  InstancedBoxMeshConfig,
  InstancedBoxMeshUpdate,
  BoxChildConfig
> {
  private config: InstancedBoxMeshConfig;

  constructor(
    view: ThreeView,
    ctx: ViewContext,
    config: InstancedBoxMeshConfig,
  ) {
    super(view, ctx, config);
    this.config = config;

    // Drive the MRT emissive uniforms from the boxes config.
    if (config.boxes?.emissiveColor !== undefined) {
      this.emissive = config.boxes.emissiveColor;
    }
    if (config.boxes?.emissiveIntensity !== undefined) {
      this.emissiveIntensity = config.boxes.emissiveIntensity;
    }
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

  protected createMaterial(): MeshLambertNodeMaterial {
    const cfg = this.boxesConfig;
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
    }
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

      if (boxesUpdate.emissiveColor !== undefined) {
        this.emissive = boxesUpdate.emissiveColor;
      }
      if (boxesUpdate.emissiveIntensity !== undefined) {
        this.emissiveIntensity = boxesUpdate.emissiveIntensity;
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
    if (this.raw) {
      this.ctx.removeShadowMaterial(this.raw.material);
    }
    super.onDestroy();
  }
}
