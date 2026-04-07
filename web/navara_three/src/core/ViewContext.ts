import type { Globe } from "@navara/core";
import { EventHandler } from "@navara/core";
import type { FontManager } from "@navara/font";
import type { ConcurrencyManager } from "@navara/worker";
import type { Pass as PostProcessingPass } from "postprocessing";
import type {
  Material,
  Object3D,
  PerspectiveCamera,
  WebGLRenderer,
} from "three";

import type { Atmosphere } from "../atmosphere";
import { Color } from "../Color";
import type { LayersManager } from "../layersManager";
import type { RenderPassOrchestrator } from "../orchestrators";
import type { Scenes } from "../scene";

import type { EffectLayerDeclaration } from "./EffectLayerDeclaration";
import type { LayerHandle } from "./LayerHandle";
import {
  getSelectiveEffectConfig,
  type SelectiveEffectHelper,
  type SelectiveEffectOcclusionValue,
} from "./SelectiveEffectHelper";
import { SelectiveEffectManager } from "./SelectiveEffectManager";

export type ViewDebugOptions = {
  selectiveEffectMask?: boolean;
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
  public selectiveEffectRegistry?: SelectiveEffectHelper;
  public debugOptions: ViewDebugOptions;
  public globe?: Globe;
  public fontManager?: FontManager;

  private readonly selectiveEffects: SelectiveEffectManager;

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
    selectiveEffectHelper?: SelectiveEffectHelper,
    debugOptions?: ViewDebugOptions,
  ) {
    super();
    this.selectiveEffectRegistry = selectiveEffectHelper;
    this.debugOptions = debugOptions ?? {};

    this.selectiveEffects = new SelectiveEffectManager({
      selectiveEffectRegistry: this.selectiveEffectRegistry,
    });
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

  registerLayerEffects(
    layerId: string,
    effectIds: string[],
    selectiveEffectOcclusion?: SelectiveEffectOcclusionValue,
    emissiveIntensity?: number,
  ): void {
    this.selectiveEffects.registerLayerEffects(
      layerId,
      effectIds,
      selectiveEffectOcclusion,
      emissiveIntensity,
    );
  }

  getLayerEffects(layerId: string): string[] | undefined {
    return this.selectiveEffects.getLayerEffects(layerId);
  }

  setLayerEmissiveColor(
    layerId: string,
    emissiveColor: Color | undefined,
  ): void {
    this.selectiveEffects.setLayerEmissiveColor(layerId, emissiveColor);
  }

  setLayerSelectiveEffectOcclusion(
    layerId: string,
    selectiveEffectOcclusion: SelectiveEffectOcclusionValue,
  ): void {
    // Delegate to Manager (the single SoT for occlusion)
    this.selectiveEffects.setLayerOcclusion(layerId, selectiveEffectOcclusion);
  }

  clearLayerSelectiveEffectOcclusion(layerId: string): void {
    this.selectiveEffects.clearLayerOcclusion(layerId);
  }

  unregisterLayerEffects(layerId: string): void {
    this.selectiveEffects.unregisterLayerEffects(layerId);
  }

  updateLayerEffects(
    layerId: string,
    effectIds: string[] | undefined,
    emissiveIntensity?: number,
  ): void {
    this.selectiveEffects.updateLayerEffects(
      layerId,
      effectIds,
      emissiveIntensity,
    );
  }

  /**
   * Apply selective effects to a specific Object3D.
   * Useful for pick-based effect application where you have a reference to the object.
   *
   * @param object - The Object3D to apply effects to
   * @param effectIds - Effect IDs to apply (e.g., ["selectiveBloom"], ["selectiveOutline"], ["selectiveBloom", "selectiveOutline"])
   * @param layerId - Optional layer ID for occlusion resolution.
   *                  Resolution order: argument > existing config > Normal occlusion
   */
  applyEffectToObject(
    object: Object3D,
    effectIds: string[],
    layerId?: string,
  ): void {
    // Resolve layerId: argument > existing config > undefined (Normal occlusion)
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
