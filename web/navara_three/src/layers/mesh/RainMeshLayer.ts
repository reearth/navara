import {
  MeshLayerDeclaration,
  type MeshLayerConfig,
  ViewContext,
  type MeshLayerUpdate,
} from "../../core";
import { DefaultRainConfig, RainMesh, type RainConfig } from "../../mesh";

type LayerDescription = {
  rain?: Partial<RainConfig>;
};

export type RainMeshLayerConfig = MeshLayerConfig & LayerDescription;

export type RainMeshLayerUpdate = MeshLayerUpdate &
  LayerDescription;

export class RainMeshLayer extends MeshLayerDeclaration<
  RainMeshLayerConfig,
  RainMeshLayerUpdate,
  RainMesh
> {
  private config: RainMeshLayerConfig;

  constructor(view: ViewContext, config: RainMeshLayerConfig) {
    super(view, config);
    this.config = config;
  }

  getPassKey(): "opaque" | "transparent" {
    return this._instance?.followCamera ? "transparent" : "opaque";
  }

  createMesh() {
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
      alphaMax: this.config.rain?.alphaMax ?? DefaultRainConfig.alphaMax,
      alphaMin: this.config.rain?.alphaMin ?? DefaultRainConfig.alphaMin,
      followCamera:
        this.config.rain?.followCamera ?? DefaultRainConfig.followCamera,
      maxHeight: this.config.rain?.maxHeight ?? DefaultRainConfig.maxHeight,
    };

    return new RainMesh(rainConfig);
  }

  onUpdateConfig(updates: RainMeshLayerUpdate): void {
    if (this.config.rain && updates.rain && this._instance) {
      Object.assign(this.config.rain, updates.rain);
      this._instance.updateConfig(updates.rain);
      this.emit("_needsUpdate");
    }

    super.onUpdateConfig(updates);
  }

  update(time: number): void {
    if (this._instance) {
      this._instance.update(time, this.view.camera);
    }
  }

  protected disposeMesh(): void {
    if (this._instance) {
      this._instance.dispose();
      this._instance = undefined;
    }
  }

  getRainMesh(): RainMesh | undefined {
    return this._instance;
  }
}
