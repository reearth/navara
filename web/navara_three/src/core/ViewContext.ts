import type { Globe } from "@navara/core";
import { EventHandler } from "@navara/core";
import type { FontManager } from "@navara/font";
import type { ConcurrencyManager } from "@navara/worker";
import type { Material, Object3D, PerspectiveCamera } from "three";

import type { Atmosphere } from "../atmosphere";
import { Color } from "../Color";
import type { LayersManager } from "../layersManager";
import type { RenderPassOrchestrator } from "../orchestrators";
import type { Scenes } from "../scene";
import type { MeshCache } from "../type";

import {
  getSelectiveEffectConfig,
  type SelectiveEffectHelper,
} from "./SelectiveEffectHelper";

/** Default emissive intensity when Bloom is enabled */
const DEFAULT_EMISSIVE_INTENSITY = 0.3;

type LayerEffectConfig = {
  effectIds: string[];
  emissiveIntensity: number;
  emissiveColor?: Color;
};

type Private = {
  meshes: MeshCache;
};

type ViewContextEvents = {
  unstableShadowApplied: (material: Material) => void;
  unstableShadowRemoved: (material: Material) => void;
};

// Restrict public API for a layer declaration.
export class ViewContext extends EventHandler<ViewContextEvents> {
  public selectiveEffectRegistry?: SelectiveEffectHelper;
  public globe?: Globe;
  public fontManager?: FontManager;

  // Layer-level selective effect configuration
  private readonly layerEffectConfigs = new Map<string, LayerEffectConfig>();

  constructor(
    public scenes: Scenes,
    public camera: PerspectiveCamera,
    public atmosphere: Atmosphere,
    public layersManager: LayersManager,
    public renderPassOrchestrator: RenderPassOrchestrator,
    public concurrencyManager: ConcurrencyManager,
    public _privates: Private,
    selectiveEffectHelper?: SelectiveEffectHelper,
  ) {
    super();
    this.selectiveEffectRegistry = selectiveEffectHelper;
  }

  setGlobe(globe: Globe) {
    this.globe = globe;
  }

  setCamera(camera: PerspectiveCamera) {
    this.camera = camera;
  }

  applyShadowMaterial(material: Material): void {
    this.emit("unstableShadowApplied", material);
  }

  removeShadowMaterial(material: Material): void {
    this.emit("unstableShadowRemoved", material);
  }

  // --- Selective Effect layer config ---

  registerLayerEffects(
    layerId: string,
    effectIds: string[],
    emissiveIntensity?: number,
  ): void {
    const config = this.ensureLayerEffectConfig(layerId);
    config.effectIds = effectIds;
    if (emissiveIntensity !== undefined) {
      config.emissiveIntensity = emissiveIntensity;
    }
  }

  getLayerEffects(layerId: string): string[] | undefined {
    return this.layerEffectConfigs.get(layerId)?.effectIds;
  }

  setLayerEmissiveColor(
    layerId: string,
    emissiveColor: Color | undefined,
  ): void {
    const config = this.ensureLayerEffectConfig(layerId);
    config.emissiveColor = emissiveColor;
  }

  unregisterLayerEffects(layerId: string): void {
    this.layerEffectConfigs.delete(layerId);
  }

  updateLayerEffects(
    layerId: string,
    effectIds: string[] | undefined,
    emissiveIntensity?: number,
  ): void {
    const config = this.ensureLayerEffectConfig(layerId);
    config.effectIds = effectIds ?? [];
    if (emissiveIntensity !== undefined) {
      config.emissiveIntensity = emissiveIntensity;
    }
  }

  private ensureLayerEffectConfig(layerId: string): LayerEffectConfig {
    let config = this.layerEffectConfigs.get(layerId);
    if (!config) {
      config = {
        effectIds: [],
        emissiveIntensity: DEFAULT_EMISSIVE_INTENSITY,
      };
      this.layerEffectConfigs.set(layerId, config);
    }
    return config;
  }

  // --- Selective Effect object management ---

  /**
   * Apply selective effects to a specific Object3D.
   * Useful for pick-based effect application where you have a reference to the object.
   *
   * @param object - The Object3D to apply effects to
   * @param effectIds - Effect IDs to apply
   * @param layerId - Optional layer ID. Resolution order: argument > existing config > empty string
   */
  applyEffectToObject(
    object: Object3D,
    effectIds: string[],
    layerId?: string,
  ): void {
    const resolvedLayerId =
      layerId ?? getSelectiveEffectConfig(object)?.layerId;

    const prevEffectIds = getSelectiveEffectConfig(object)?.effectIds ?? [];
    this.selectiveEffectRegistry?.updateLinksForObject(
      object,
      effectIds,
      prevEffectIds,
      resolvedLayerId ?? "",
    );
  }

  /**
   * Remove selective effects from a specific Object3D.
   *
   * @param object - The Object3D to remove effects from
   * @param effectIds - Effect IDs to remove. If undefined, removes all effects.
   */
  removeEffectFromObject(object: Object3D, effectIds?: string[]): void {
    const config = getSelectiveEffectConfig(object);
    if (!config) return;

    const prevEffectIds = config.effectIds;
    const nextEffectIds = effectIds
      ? prevEffectIds.filter((id) => !effectIds.includes(id))
      : [];

    this.selectiveEffectRegistry?.updateLinksForObject(
      object,
      nextEffectIds,
      prevEffectIds,
      config.layerId ?? "",
    );
  }
}
