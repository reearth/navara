import type { SelectiveEffectRegistry } from "./SelectiveEffectRegistry";

type LayerEffectConfig = {
  effectIds: string[];
  emissiveIntensity: number;
  emissiveColor?: number;
  postEffectDepthTest: boolean;
};

type PostEffectManagerOptions = {
  selectiveRegistry?: SelectiveEffectRegistry;
};

export class PostEffectManager {
  private readonly layerConfigs = new Map<string, LayerEffectConfig>();

  constructor(private readonly options: PostEffectManagerOptions) {}

  registerLayerEffects(
    layerId: string,
    effectIds: string[],
    postEffectDepthTest?: boolean,
    emissiveIntensity?: number,
    options?: { keepClones?: boolean },
  ): void {
    const config = this.ensureConfig(layerId);

    config.effectIds = effectIds;
    if (emissiveIntensity !== undefined) {
      config.emissiveIntensity = emissiveIntensity;
    }
    if (postEffectDepthTest !== undefined) {
      config.postEffectDepthTest = postEffectDepthTest;
    }

    if (postEffectDepthTest !== undefined && this.options.selectiveRegistry) {
      this.options.selectiveRegistry.registerLayerPostEffectDepthTest(
        layerId,
        postEffectDepthTest,
      );
    }

    if (this.options.selectiveRegistry) {
      this.options.selectiveRegistry.registerLayerKeepClones(
        layerId,
        options?.keepClones,
      );
    }
  }

  unregisterLayerEffects(layerId: string): void {
    this.layerConfigs.delete(layerId);
    this.options.selectiveRegistry?.registerLayerKeepClones(layerId, false);
  }

  getLayerEffects(layerId: string): string[] | undefined {
    const config = this.layerConfigs.get(layerId);
    return config?.effectIds.length ? config.effectIds : undefined;
  }

  getLayerEmissiveIntensity(layerId: string): number {
    return this.layerConfigs.get(layerId)?.emissiveIntensity ?? 0.3;
  }

  getLayerEmissiveColor(layerId: string): number | undefined {
    return this.layerConfigs.get(layerId)?.emissiveColor;
  }

  getLayerPostEffectDepthTest(layerId: string): boolean {
    return this.layerConfigs.get(layerId)?.postEffectDepthTest ?? true;
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
    this.layerConfigs.set(layerId, config);

    // Cache update only - actual effect application happens via layer.update()
    // which triggers Rust event stream or MeshLayerDeclaration.onUpdateConfig()
  }

  setLayerPostEffectDepthTest(
    layerId: string,
    postEffectDepthTest: boolean,
  ): void {
    const config = this.ensureConfig(layerId);

    if (config.postEffectDepthTest === postEffectDepthTest) {
      return;
    }

    config.postEffectDepthTest = postEffectDepthTest;
    this.layerConfigs.set(layerId, config);

    this.options.selectiveRegistry?.updateLayerPostEffectDepthTest(
      layerId,
      postEffectDepthTest,
    );

    // Cache update only - actual effect application happens via layer.update()
    // which triggers Rust event stream or MeshLayerDeclaration.onUpdateConfig()
  }

  updateLayerEffects(
    layerId: string,
    effectIds: string[] | undefined,
    emissiveIntensity?: number,
    options?: { keepClones?: boolean },
  ): void {
    const newEffectIds = effectIds ?? [];
    this.updateLayerEffectCaches(
      layerId,
      newEffectIds,
      emissiveIntensity,
      options,
    );

    // Cache update only - actual effect application happens via layer.update()
    // which triggers Rust event stream or MeshLayerDeclaration.onUpdateConfig()
  }

  private ensureConfig(layerId: string): LayerEffectConfig {
    if (!this.layerConfigs.has(layerId)) {
      this.layerConfigs.set(layerId, {
        effectIds: [],
        emissiveIntensity: 0.3,
        postEffectDepthTest: true,
      });
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.layerConfigs.get(layerId)!;
  }

  private updateLayerEffectCaches(
    layerId: string,
    newEffectIds: string[],
    emissiveIntensity: number | undefined,
    options?: { keepClones?: boolean },
  ): void {
    const config = this.ensureConfig(layerId);

    config.effectIds = newEffectIds;
    if (emissiveIntensity !== undefined) {
      config.emissiveIntensity = emissiveIntensity;
    }

    if (options?.keepClones !== undefined && this.options.selectiveRegistry) {
      this.options.selectiveRegistry.registerLayerKeepClones(
        layerId,
        options.keepClones,
      );
    }
  }
}
