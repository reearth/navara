import {
  LayerView,
  MeshLayerDeclaration,
  type MeshLayerConfig,
} from "../../core";
import { DefaultSnowConfig, SnowMesh, type SnowConfig } from "../../mesh";

type LayerDescription = {
  snow?: Partial<SnowConfig>;
};

export type SnowMeshLayerConfig = MeshLayerConfig & LayerDescription;

export type SnowMeshLayerUpdate = Pick<
  MeshLayerConfig,
  "position" | "visible"
> &
  LayerDescription;

export class SnowMeshLayer extends MeshLayerDeclaration<
  SnowMeshLayerConfig,
  SnowMeshLayerUpdate,
  SnowMesh
> {
  private config: SnowMeshLayerConfig;

  constructor(view: LayerView, config: SnowMeshLayerConfig) {
    super(view, config);
    this.config = config;
  }

  getPassKey(): "opaque" | "transparent" {
    return this.config.snow?.followCamera ? "transparent" : "opaque";
  }

  createMesh(): SnowMesh {
    const snowConfig: Partial<SnowConfig> = {
      particleCount:
        this.config.snow?.particleCount ?? DefaultSnowConfig.particleCount,
      radius: this.config.snow?.radius ?? DefaultSnowConfig.radius,
      areaWidth: this.config.snow?.areaWidth ?? DefaultSnowConfig.areaWidth,
      areaHeight: this.config.snow?.areaHeight ?? DefaultSnowConfig.areaHeight,
      speed: this.config.snow?.speed ?? DefaultSnowConfig.speed,
      size: this.config.snow?.size ?? DefaultSnowConfig.size,
      color: this.config.snow?.color ?? DefaultSnowConfig.color,
      xMovementStrength:
        this.config.snow?.xMovementStrength ??
        DefaultSnowConfig.xMovementStrength,
      xMovementSpeed:
        this.config.snow?.xMovementSpeed ?? DefaultSnowConfig.xMovementSpeed,
      zMovementStrength:
        this.config.snow?.zMovementStrength ??
        DefaultSnowConfig.zMovementStrength,
      zMovementSpeed:
        this.config.snow?.zMovementSpeed ?? DefaultSnowConfig.zMovementSpeed,
      yMovementStrength:
        this.config.snow?.yMovementStrength ??
        DefaultSnowConfig.yMovementStrength,
      yMovementSpeed:
        this.config.snow?.yMovementSpeed ?? DefaultSnowConfig.yMovementSpeed,
      followCamera:
        this.config.snow?.followCamera ?? DefaultSnowConfig.followCamera,
      maxHeight: this.config.snow?.maxHeight ?? DefaultSnowConfig.maxHeight,
      opacity: this.config.snow?.opacity ?? DefaultSnowConfig.opacity,
    };

    return new SnowMesh(snowConfig);
  }

  onUpdateConfig(updates: SnowMeshLayerUpdate): void {
    super.onUpdateConfig(updates);

    if (this.config.snow && updates.snow && this.instance) {
      Object.assign(this.config.snow, updates.snow);
      this.instance.updateConfig(updates.snow);
    }
  }

  update(time: number): void {
    this.instance?.update(time, this.view.camera);
  }

  protected disposeMesh(): void {
    if (this.instance) {
      this.instance.dispose();
      this.instance = null;
    }
  }
}
