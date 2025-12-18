import {
  type PostEffectHelper,
  type PostEffectOcclusionValue,
  PostEffectOcclusionMode,
} from "./PostEffectHelper";

/** Default emissive intensity when Bloom is enabled */
const DEFAULT_EMISSIVE_INTENSITY = 0.3;

type LayerEffectConfig = {
  effectIds: string[];
  emissiveIntensity: number;
  emissiveColor?: number;
  occlusion: PostEffectOcclusionValue; // SoT for occlusion setting
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

    // Store occlusion in config (SoT) and sync to Helper cache
    if (postEffectOcclusion !== undefined) {
      config.occlusion = postEffectOcclusion;
    }
    this.options.postEffectRegistry?.syncOcclusionCache(
      layerId,
      config.occlusion,
    );
  }

  unregisterLayerEffects(layerId: string): void {
    this.layerConfigs.delete(layerId);
  }

  getLayerEffects(layerId: string): string[] | undefined {
    const config = this.layerConfigs.get(layerId);
    return config?.effectIds;
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
        occlusion: PostEffectOcclusionMode.Normal,
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

  /**
   * Get occlusion setting for a layer (SoT)
   */
  getLayerOcclusion(layerId: string): PostEffectOcclusionValue {
    const config = this.layerConfigs.get(layerId);
    return config?.occlusion ?? PostEffectOcclusionMode.Normal;
  }

  /**
   * Set occlusion setting for a layer (SoT)
   */
  setLayerOcclusion(
    layerId: string,
    occlusion: PostEffectOcclusionValue,
  ): void {
    const config = this.ensureConfig(layerId);
    config.occlusion = occlusion;
    // Sync to Helper cache
    this.options.postEffectRegistry?.syncOcclusionCache(layerId, occlusion);
  }
}
