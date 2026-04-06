import type { Globe } from "@navara/core";
import { EventHandler } from "@navara/core";
import type { FontManager } from "@navara/font";
import type { ConcurrencyManager } from "@navara/worker";
import { type Material, type PerspectiveCamera } from "three";

import type { Atmosphere } from "../atmosphere";
import { Color } from "../Color";
import type { LayersManager } from "../layersManager";
import type { RenderPassOrchestrator } from "../orchestrators";
import type { Scenes } from "../scene";
import type { MeshCache } from "../type";

import type { EffectSlotRegistry } from "./EffectSlotRegistry";
import type { SelectiveEffectHelper } from "./SelectiveEffectHelper";

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
  /**
   * Emitted when a material is registered for CSM shadow rendering.
   * @experimental This event may change or be removed in future versions.
   */
  shadowApplied: (material: Material) => void;
  /**
   * Emitted when a material is unregistered from CSM shadow rendering.
   * @experimental This event may change or be removed in future versions.
   */
  shadowRemoved: (material: Material) => void;
};

// Restrict public API for a layer declaration.
export class ViewContext extends EventHandler<ViewContextEvents> {
  public selectiveEffectRegistry?: SelectiveEffectHelper;
  public effectSlotRegistry?: EffectSlotRegistry;
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
    this.emit("shadowApplied", material);
  }

  removeShadowMaterial(material: Material): void {
    this.emit("shadowRemoved", material);
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
}
