import type { Object3D } from "three";

import { Layer } from "../layer";
import type { LayersManager } from "../layersManager";
import type { CustomObject3DEvent } from "../object3DEvent";

import type { LayerHandle } from "./LayerHandle";
import type { SelectiveEffectRegistry } from "./SelectiveEffectRegistry";

type LayerEffectConfig = {
  effects: string[];
  emissiveIntensity: number;
  emissiveColor?: number;
  selectiveDepthTest: boolean;
};

type PostEffectManagerOptions = {
  layersManager: LayersManager;
  selectiveRegistry?: SelectiveEffectRegistry;
  dispatchEvent: (obj: Object3D, event: CustomObject3DEvent) => void;
  getLayerHandleObject: (layerHandle: LayerHandle) => Object3D | undefined;
  requestRender: (layer: Layer | LayerHandle | undefined) => void;
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

    const layer = this.options.layersManager.get(layerId);
    if (!layer) return;

    const intensity = this.getLayerEmissiveIntensity(layerId);
    this.dispatchEmissive(layer, layerId, intensity, emissiveColor);
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

    const layer = this.options.layersManager.get(layerId);
    if (!layer) return;

    this.dispatchSelectiveDepthTest(layer, layerId, selectiveDepthTest);
  }

  updateLayerEffects(
    layerId: string,
    effects: string[] | undefined,
    emissiveIntensity?: number,
    options?: { keepClones?: boolean },
  ): void {
    const layer = this.options.layersManager.get(layerId);
    if (!layer) return;

    const prevConfig = this.layerConfigs.get(layerId);
    const prevEffects = prevConfig?.effects ?? [];
    const newEffects = effects ?? [];

    this.updateLayerEffectCaches(
      layerId,
      newEffects,
      emissiveIntensity,
      options,
    );

    if (!this.options.selectiveRegistry) return;

    const intensity = this.getLayerEmissiveIntensity(layerId);
    const emissiveColor = this.getLayerEmissiveColor(layerId);

    if (layer instanceof Layer) {
      for (const evaluator of layer._getFeatureEvaluators()) {
        const obj = evaluator.obj;
        if (!obj) continue;

        this.options.dispatchEvent(obj, {
          type: "layerEffectsChanged",
          target: obj,
          effects: newEffects,
          emissiveIntensity: intensity,
          layerId,
          prevEffects,
        });

        if (newEffects.length > 0) {
          this.options.dispatchEvent(obj, {
            type: "emissive",
            target: obj,
            emissiveIntensity: intensity,
            emissiveColor,
            layerId,
          });
        }
      }
      this.options.requestRender(layer);
      return;
    }

    const obj = this.options.getLayerHandleObject(layer);
    if (!obj) return;

    this.options.dispatchEvent(obj, {
      type: "layerEffectsChanged",
      target: obj,
      effects: newEffects,
      emissiveIntensity: intensity,
      layerId,
      prevEffects,
    });

    if (newEffects.length > 0) {
      this.options.dispatchEvent(obj, {
        type: "emissive",
        target: obj,
        emissiveIntensity: intensity,
        emissiveColor,
        layerId,
      });
    }

    this.options.requestRender(layer);
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

  private dispatchEmissive(
    layer: Layer | LayerHandle,
    layerId: string,
    emissiveIntensity: number,
    emissiveColor: number | undefined,
  ): void {
    if (layer instanceof Layer) {
      for (const evaluator of layer._getFeatureEvaluators()) {
        const obj = evaluator.obj;
        if (!obj) continue;

        this.options.dispatchEvent(obj, {
          type: "emissive",
          target: obj,
          emissiveIntensity,
          emissiveColor,
          layerId,
        });
      }
      this.options.requestRender(layer);
      return;
    }

    const obj = this.options.getLayerHandleObject(layer);
    if (!obj) return;

    this.options.dispatchEvent(obj, {
      type: "emissive",
      target: obj,
      emissiveIntensity,
      emissiveColor,
      layerId,
    });

    this.options.requestRender(layer);
  }

  private dispatchSelectiveDepthTest(
    layer: Layer | LayerHandle,
    layerId: string,
    selectiveDepthTest: boolean,
  ): void {
    if (layer instanceof Layer) {
      for (const evaluator of layer._getFeatureEvaluators()) {
        const obj = evaluator.obj;
        if (!obj) continue;

        this.options.dispatchEvent(obj, {
          type: "selectiveDepthTestChanged",
          target: obj,
          selectiveDepthTest,
          layerId,
        });
      }
      this.options.requestRender(layer);
      return;
    }

    const obj = this.options.getLayerHandleObject(layer);
    if (!obj) return;

    this.options.dispatchEvent(obj, {
      type: "selectiveDepthTestChanged",
      target: obj,
      selectiveDepthTest,
      layerId,
    });

    this.options.requestRender(layer);
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
