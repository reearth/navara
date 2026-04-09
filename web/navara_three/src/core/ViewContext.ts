import type { Globe } from "@navara/core";
import { EventHandler } from "@navara/core";
import type { FontManager } from "@navara/font";
import type { ConcurrencyManager } from "@navara/worker";
import type { Pass as PostProcessingPass } from "postprocessing";
import type { Material, PerspectiveCamera, WebGLRenderer } from "three";

import type { Atmosphere } from "../atmosphere";
import { Color } from "../Color";
import type { LayersManager } from "../layersManager";
import type { RenderPassOrchestrator } from "../orchestrators";
import type { Scenes } from "../scene";

import type { EffectLayerDeclaration } from "./EffectLayerDeclaration";
import type { LayerHandle } from "./LayerHandle";
import type { SelectiveEffectRegistry } from "./SelectiveEffectRegistry";

/** Default emissive intensity when Bloom is enabled */
const DEFAULT_EMISSIVE_INTENSITY = 0.3;

type LayerEffectConfig = {
  effectIds: string[];
  emissiveIntensity: number;
  emissiveColor?: Color;
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
  /**
   * Emitted when effect slot assignments change in SelectiveEffectRegistry.
   * Listeners should recompute effectIdsMask to stay in sync.
   */
  effectSlotsChanged: () => void;
};

/**
 * ViewContext is the shared context object passed to every custom layer and plugin.
 *
 * The public properties and methods defined here form the **public API surface**
 * exposed to user-authored layers and plugins. Any addition, removal, or
 * signature change to a public member is a **breaking change** for consumers.
 *
 * When extending this class, keep the public surface minimal and intentional:
 * - Prefer methods over exposing internal objects directly — this allows the
 *   implementation to change without breaking downstream code.
 * - Mark internal dependencies as `private` so they are not accessible from
 *   layer/plugin code.
 */
export class ViewContext extends EventHandler<ViewContextEvents> {
  public selectiveEffectRegistry?: SelectiveEffectRegistry;
  public globe?: Globe;
  public fontManager?: FontManager;

  // Layer-level selective effect configuration
  private readonly layerEffectConfigs = new Map<string, LayerEffectConfig>();

  constructor(
    /** Scene containers for different rendering passes. */
    public scenes: Scenes,
    /** The main perspective camera used for rendering. */
    public camera: PerspectiveCamera,
    /** Atmosphere parameters (sun direction, time of day, etc.). */
    public atmosphere: Atmosphere,
    private layersManager: LayersManager,
    private renderPassOrchestrator: RenderPassOrchestrator,
    /** Manager for scheduling work on Web Workers. */
    public concurrencyManager: ConcurrencyManager,
  ) {
    super();
  }

  /** Set or replace the SelectiveEffectRegistry, wiring up the slotsChanged signal. */
  setSelectiveEffectRegistry(
    registry: SelectiveEffectRegistry | undefined,
  ): void {
    // Disconnect previous registry
    if (this.selectiveEffectRegistry) {
      this.selectiveEffectRegistry.onSlotsChanged = undefined;
    }
    this.selectiveEffectRegistry = registry;
    // Connect new registry
    if (registry) {
      registry.onSlotsChanged = () => this.emit("effectSlotsChanged");
    }
  }

  // --- Pass management ---

  /** Get a post-processing pass by name. */
  getPass(name: string): PostProcessingPass | undefined {
    return this.renderPassOrchestrator.getPass(name);
  }

  /** Add a post-processing pass to the end of the pipeline. */
  addPass(name: string, pass: PostProcessingPass): void {
    this.renderPassOrchestrator.addPass(name, pass);
  }

  /** Insert a post-processing pass before the pass identified by `targetName`. */
  insertPassBefore(
    targetName: string,
    name: string,
    pass: PostProcessingPass,
  ): void {
    this.renderPassOrchestrator.insertPassBefore(targetName, name, pass);
  }

  /** Insert a post-processing pass after the pass identified by `targetName`. */
  insertPassAfter(
    targetName: string,
    name: string,
    pass: PostProcessingPass,
  ): void {
    this.renderPassOrchestrator.insertPassAfter(targetName, name, pass);
  }

  /** Remove a post-processing pass by name. */
  removePass(name: string): void {
    this.renderPassOrchestrator.removePass(name);
  }

  // --- Renderer/buffer access ---

  /** Get the underlying WebGLRenderer instance. */
  getRenderer(): WebGLRenderer {
    return this.renderPassOrchestrator.effectComposer.getRenderer();
  }

  /** Get the input buffer from the effect composer. */
  getInputBuffer() {
    return this.renderPassOrchestrator.effectComposer.inputBuffer;
  }

  // --- Layer query ---

  /** @internal Iterate over all registered effect layers. */
  _getEffectLayers(): Generator<LayerHandle<EffectLayerDeclaration>> {
    return this.layersManager.getEffectLayers();
  }

  /**
   * Register a material for CSM shadow rendering.
   * @experimental This API may change or be removed in future versions.
   */
  applyShadowMaterial(material: Material): void {
    this.emit("shadowApplied", material);
  }

  /**
   * Unregister a material from CSM shadow rendering.
   * @experimental This API may change or be removed in future versions.
   */
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
