import { Color } from "../Color";

import {
  type SelectiveEffectHelper,
  type SelectiveEffectOcclusionValue,
  SelectiveEffectOcclusionMode,
} from "./SelectiveEffectHelper";

/** Default emissive intensity when Bloom is enabled */
const DEFAULT_EMISSIVE_INTENSITY = 0.3;

type LayerEffectConfig = {
  effectIds: string[];
  emissiveIntensity: number;
  emissiveColor?: Color;
  occlusion: SelectiveEffectOcclusionValue; // SoT for occlusion setting
};

type SelectiveEffectManagerOptions = {
  selectiveEffectRegistry?: SelectiveEffectHelper;
};

/** @deprecated SE Redesign - will be removed */
export class SelectiveEffectManager {
  private readonly layerConfigs = new Map<string, LayerEffectConfig>();

  /**
   * Layer-level single source of truth for effect configuration.
   * PostEffectRegistry only consumes these layer settings; no per-object overrides are applied here.
   */

  constructor(private readonly options: SelectiveEffectManagerOptions) {}

  registerLayerEffects(
    layerId: string,
    effectIds: string[],
    selectiveEffectOcclusion?: SelectiveEffectOcclusionValue,
    emissiveIntensity?: number,
  ): void {
    const config = this.ensureConfig(layerId);

    config.effectIds = effectIds;
    if (emissiveIntensity !== undefined) {
      config.emissiveIntensity = emissiveIntensity;
    }

    // Store occlusion in config (SoT) and sync to Helper cache
    if (selectiveEffectOcclusion !== undefined) {
      config.occlusion = selectiveEffectOcclusion;
    }
    this.options.selectiveEffectRegistry?.syncOcclusionCache(
      layerId,
      config.occlusion,
    );
  }

  unregisterLayerEffects(layerId: string): void {
    this.layerConfigs.delete(layerId);
    // Also clear occlusion cache in Helper
    this.options.selectiveEffectRegistry?.clearOcclusionCache(layerId);
  }

  getLayerEffects(layerId: string): string[] | undefined {
    const config = this.layerConfigs.get(layerId);
    return config?.effectIds;
  }

  setLayerEmissiveColor(
    layerId: string,
    emissiveColor: Color | undefined,
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
        occlusion: SelectiveEffectOcclusionMode.Normal,
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
  getLayerOcclusion(layerId: string): SelectiveEffectOcclusionValue {
    const config = this.layerConfigs.get(layerId);
    return config?.occlusion ?? SelectiveEffectOcclusionMode.Normal;
  }

  /**
   * Set occlusion setting for a layer (SoT)
   */
  setLayerOcclusion(
    layerId: string,
    occlusion: SelectiveEffectOcclusionValue,
  ): void {
    const config = this.ensureConfig(layerId);
    config.occlusion = occlusion;
    // Sync to Helper cache
    this.options.selectiveEffectRegistry?.syncOcclusionCache(
      layerId,
      occlusion,
    );
  }

  /**
   * Clear occlusion setting for a layer (reset to Normal).
   * Also syncs to Helper cache to maintain SoT consistency.
   */
  clearLayerOcclusion(layerId: string): void {
    const config = this.layerConfigs.get(layerId);
    if (config) {
      // Reset to default (Normal)
      config.occlusion = SelectiveEffectOcclusionMode.Normal;
      // Sync to Helper cache (SoT: Manager → Helper)
      this.options.selectiveEffectRegistry?.syncOcclusionCache(
        layerId,
        config.occlusion,
      );
    }
  }
}
