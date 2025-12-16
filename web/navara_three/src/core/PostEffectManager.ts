import {
  PostEffectOcclusionMode,
  type PostEffectHelper,
  type PostEffectOcclusionValue,
} from "./PostEffectHelper";

/** Default emissive intensity when Bloom is enabled */
const DEFAULT_EMISSIVE_INTENSITY = 0.3;

type LayerEffectConfig = {
  effectIds: string[];
  emissiveIntensity: number;
  emissiveColor?: number;
  postEffectOcclusion: PostEffectOcclusionValue;
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
    postEffectOcclusion?: PostEffectOcclusionValue,
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

  getLayerPostEffectOcclusion(layerId: string): PostEffectOcclusionValue {
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
    postEffectOcclusion: PostEffectOcclusionValue,
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
