import type { SelectiveEffectRegistry } from "./SelectiveEffectRegistry";

type LayerEffectConfig = {
  effects: string[];
  emissiveIntensity: number;
  emissiveColor?: number;
  selectiveDepthTest: boolean;
};

type PostEffectManagerOptions = {
  selectiveRegistry?: SelectiveEffectRegistry;
};

export class PostEffectManager {
  private readonly layerConfigs = new Map<string, LayerEffectConfig>();

  constructor(private readonly options: PostEffectManagerOptions) {}

  registerLayerEffects(
    layerId: string,
    effects: string[],
    selectiveDepthTest?: boolean,
    emissiveIntensity?: number,
    options?: { keepClones?: boolean },
  ): void {
    const config = this.ensureConfig(layerId);

    config.effects = effects;
    if (emissiveIntensity !== undefined) {
      config.emissiveIntensity = emissiveIntensity;
    }
    if (selectiveDepthTest !== undefined) {
      config.selectiveDepthTest = selectiveDepthTest;
    }

    if (selectiveDepthTest !== undefined && this.options.selectiveRegistry) {
      this.options.selectiveRegistry.registerLayerSelectiveDepthTest(
        layerId,
        selectiveDepthTest,
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
    return config?.effects.length ? config.effects : undefined;
  }

  getLayerEmissiveIntensity(layerId: string): number {
    return this.layerConfigs.get(layerId)?.emissiveIntensity ?? 0.3;
  }

  getLayerEmissiveColor(layerId: string): number | undefined {
    return this.layerConfigs.get(layerId)?.emissiveColor;
  }

  getLayerSelectiveDepthTest(layerId: string): boolean {
    return this.layerConfigs.get(layerId)?.selectiveDepthTest ?? true;
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

  setLayerSelectiveDepthTest(
    layerId: string,
    selectiveDepthTest: boolean,
  ): void {
    const config = this.ensureConfig(layerId);

    if (config.selectiveDepthTest === selectiveDepthTest) {
      return;
    }

    config.selectiveDepthTest = selectiveDepthTest;
    this.layerConfigs.set(layerId, config);

    this.options.selectiveRegistry?.updateLayerSelectiveDepthTest(
      layerId,
      selectiveDepthTest,
    );

    // Cache update only - actual effect application happens via layer.update()
    // which triggers Rust event stream or MeshLayerDeclaration.onUpdateConfig()
  }

  updateLayerEffects(
    layerId: string,
    effects: string[] | undefined,
    emissiveIntensity?: number,
    options?: { keepClones?: boolean },
  ): void {
    const newEffects = effects ?? [];

    this.updateLayerEffectCaches(
      layerId,
      newEffects,
      emissiveIntensity,
      options,
    );

    // Cache update only - actual effect application happens via layer.update()
    // which triggers Rust event stream or MeshLayerDeclaration.onUpdateConfig()
  }

  private ensureConfig(layerId: string): LayerEffectConfig {
    if (!this.layerConfigs.has(layerId)) {
      this.layerConfigs.set(layerId, {
        effects: [],
        emissiveIntensity: 0.3,
        selectiveDepthTest: true,
      });
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.layerConfigs.get(layerId)!;
  }

  private updateLayerEffectCaches(
    layerId: string,
    newEffects: string[],
    emissiveIntensity: number | undefined,
    options?: { keepClones?: boolean },
  ): void {
    const config = this.ensureConfig(layerId);

    config.effects = newEffects;
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
