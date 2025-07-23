import {
  MeshLayerDeclaration,
  type MeshLayerConfig,
  LayerView,
} from "../../core";
import { DefaultRainConfig, RainMesh, type RainConfig } from "../../mesh";

type LayerDescription = {
  rain?: Partial<RainConfig>;
};

export type RainMeshLayerConfig = MeshLayerConfig & LayerDescription;

export type RainMeshLayerUpdate = Pick<
  MeshLayerConfig,
  "position" | "visible"
> &
  LayerDescription;

export class RainMeshLayer extends MeshLayerDeclaration<
  RainMeshLayerConfig,
  RainMeshLayerUpdate,
  RainMesh
> {
  private config: RainMeshLayerConfig;

  constructor(view: LayerView, config: RainMeshLayerConfig) {
    super(view, config);
    this.config = config;
  }

  getPassKey(): "opaque" | "transparent" {
    return this.config.rain?.followCamera ? "transparent" : "opaque";
  }

  createMesh(): RainMesh {
    const rainConfig: Partial<RainConfig> = {
      particleCount:
        this.config.rain?.particleCount ?? DefaultRainConfig.particleCount,
      speed: this.config.rain?.speed ?? DefaultRainConfig.speed,
      color: this.config.rain?.color ?? DefaultRainConfig.color,
      areaWidth: this.config.rain?.areaWidth ?? DefaultRainConfig.areaWidth,
      areaHeight: this.config.rain?.areaHeight ?? DefaultRainConfig.areaHeight,
      width: this.config.rain?.width ?? DefaultRainConfig.width,
      height: this.config.rain?.height ?? DefaultRainConfig.height,
      radius: this.config.rain?.radius ?? DefaultRainConfig.radius,
      opacity: this.config.rain?.opacity ?? DefaultRainConfig.opacity,
      diffuse: this.config.rain?.diffuse ?? DefaultRainConfig.diffuse,
      followCamera:
        this.config.rain?.followCamera ?? DefaultRainConfig.followCamera,
      maxHeight: this.config.rain?.maxHeight ?? DefaultRainConfig.maxHeight,
      standardAssetUrl:
        this.config.rain?.standardAssetUrl ??
        DefaultRainConfig.standardAssetUrl,
      diffuseAssetUrl:
        this.config.rain?.diffuseAssetUrl ?? DefaultRainConfig.diffuseAssetUrl,
    };

    return new RainMesh(rainConfig);
  }

  onUpdateConfig(updates: RainMeshLayerUpdate): void {
    super.onUpdateConfig(updates);

    if (this.config.rain && updates.rain && this.instance) {
      Object.assign(this.config.rain, updates.rain);
      this.instance.updateConfig(updates.rain);
    }
  }

  update(time: number): void {
    if (this.instance) {
      this.instance.update(
        time,
        this.view.camera,
        this.view.atmosphere.sunDirection,
      );
    }
  }

  animate(_deltaTime: number): void {
    // Rain mesh handles animation through its update method
    // No separate animation step needed
  }

  protected disposeMesh(): void {
    if (this.instance) {
      this.instance.dispose();
      this.instance = null;
    }
  }

  getRainMesh(): RainMesh | null {
    return this.instance;
  }
}
