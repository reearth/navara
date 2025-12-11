import {
  DEFAULT_EMISSIVE_INTENSITY,
  PostEffectOcclusionMode,
  type PostEffectHelper,
} from "./PostEffectHelper";

type LayerEffectConfig = {
  effectIds: string[];
  emissiveIntensity: number;
  emissiveColor?: number;
  postEffectOcclusion: number;
};

type PostEffectManagerOptions = {
  postEffectRegistry?: PostEffectHelper;
};

export class PostEffectManager {
  private readonly layerConfigs = new Map<string, LayerEffectConfig>();

  /**
   * Layer-level single source of truth for effect configuration.
   * PostEffectRegistry only consumes these layer settings; no per-object overrides are applied here.
   */

  constructor(private readonly options: PostEffectManagerOptions) {}

  registerLayerEffects(
    layerId: string,
    effectIds: string[],
    postEffectOcclusion?: number,
    emissiveIntensity?: number,
  ): void {
    const config = this.ensureConfig(layerId);

    config.effectIds = effectIds;
    if (emissiveIntensity !== undefined) {
      config.emissiveIntensity = emissiveIntensity;
    }
    if (postEffectOcclusion !== undefined) {
      config.postEffectOcclusion = postEffectOcclusion;
    }

    if (postEffectOcclusion !== undefined && this.options.postEffectRegistry) {
      this.options.postEffectRegistry.registerLayerPostEffectOcclusion(
        layerId,
        postEffectOcclusion,
      );
    }
  }

  unregisterLayerEffects(layerId: string): void {
    this.layerConfigs.delete(layerId);
  }

  getLayerEffects(layerId: string): string[] | undefined {
    const config = this.layerConfigs.get(layerId);
    return config?.effectIds;
  }

  getLayerEmissiveIntensity(layerId: string): number {
    return (
      this.layerConfigs.get(layerId)?.emissiveIntensity ??
      DEFAULT_EMISSIVE_INTENSITY
    );
  }

  getLayerEmissiveColor(layerId: string): number | undefined {
    return this.layerConfigs.get(layerId)?.emissiveColor;
  }

  getLayerPostEffectOcclusion(layerId: string): number {
    return (
      this.layerConfigs.get(layerId)?.postEffectOcclusion ??
      PostEffectOcclusionMode.Normal
    );
  }

  setLayerEmissiveColor(
    layerId: string,
    emissiveColor: number | undefined,
  ): void {
    const config = this.ensureConfig(layerId);

    if (config.emissiveColor === emissiveColor) {
      return;
    }

    config.emissiveColor = emissiveColor;
  }

  setLayerPostEffectOcclusion(
    layerId: string,
    postEffectOcclusion: number,
  ): void {
    const config = this.ensureConfig(layerId);

    if (config.postEffectOcclusion === postEffectOcclusion) {
      return;
    }

    config.postEffectOcclusion = postEffectOcclusion;

    this.options.postEffectRegistry?.updateLayerPostEffectOcclusion(
      layerId,
      postEffectOcclusion,
    );
  }

  updateLayerEffects(
    layerId: string,
    effectIds: string[] | undefined,
    emissiveIntensity?: number,
  ): void {
    const newEffectIds = effectIds ?? [];
    this.updateLayerEffectCaches(layerId, newEffectIds, emissiveIntensity);
  }

  private ensureConfig(layerId: string): LayerEffectConfig {
    let config = this.layerConfigs.get(layerId);
    if (!config) {
      config = {
        effectIds: [],
        emissiveIntensity: DEFAULT_EMISSIVE_INTENSITY,
        postEffectOcclusion: PostEffectOcclusionMode.Normal,
      };
      this.layerConfigs.set(layerId, config);
    }
    return config;
  }

  private updateLayerEffectCaches(
    layerId: string,
    newEffectIds: string[],
    emissiveIntensity: number | undefined,
  ): void {
    const config = this.ensureConfig(layerId);

    config.effectIds = newEffectIds;
    if (emissiveIntensity !== undefined) {
      config.emissiveIntensity = emissiveIntensity;
    }
  }
}
