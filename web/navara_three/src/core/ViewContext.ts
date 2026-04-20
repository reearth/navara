import { EventHandler } from "@navara/core";
import type { ConcurrencyManager } from "@navara/worker";
import type { Pass as PostProcessingPass } from "postprocessing";
import type { Material, WebGLRenderer } from "three";
import invariant from "tiny-invariant";

import type { LayersManager } from "../layersManager";
import type { RenderPassOrchestrator } from "../orchestrators";
import type { CustomRenderPass } from "../passes";
import type { Scenes } from "../scene";

import type { EffectHandle } from "./BaseHandle";
import { SelectiveEffectRegistry } from "./SelectiveEffectRegistry";

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
 * ViewContext is the shared context object passed to every custom descriptor and plugin.
 *
 * The public properties and methods defined here form the **public API surface**
 * exposed to user-authored descriptors and plugins. Any addition, removal, or
 * signature change to a public member is a **breaking change** for consumers.
 *
 * When extending this class, keep the public surface minimal and intentional:
 * - Prefer methods over exposing internal objects directly — this allows the
 *   implementation to change without breaking downstream code.
 * - Mark internal dependencies as `private` so they are not accessible from
 *   descriptor/plugin code.
 */
export class ViewContext extends EventHandler<ViewContextEvents> {
  private _selectiveEffectRegistry: SelectiveEffectRegistry;
  private _renderPass?: CustomRenderPass;

  constructor(
    /** Scene containers for different rendering passes. */
    private _scenes: Scenes,
    private layersManager: LayersManager,
    private renderPassOrchestrator: RenderPassOrchestrator,
    /** Manager for scheduling work on Web Workers. */
    private _concurrencyManager: ConcurrencyManager,
  ) {
    super();

    this._selectiveEffectRegistry = new SelectiveEffectRegistry(() =>
      this.emit("effectSlotsChanged"),
    );
  }

  /** Scene containers for different rendering passes. */
  get scenes(): Scenes {
    return this._scenes;
  }

  /** Manager for scheduling work on Web Workers. */
  get concurrencyManager(): ConcurrencyManager {
    return this._concurrencyManager;
  }

  get selectiveEffectRegistry(): SelectiveEffectRegistry {
    return this._selectiveEffectRegistry;
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

  /** @internal */
  _setRenderPass(renderPass: CustomRenderPass) {
    this._renderPass = renderPass;
  }

  /**
   * Gets the globe depth texture for post-processing effects.
   */
  getGlobeDepthTexture() {
    invariant(this._renderPass, "CustomRenderPass isn't initialized yet.");
    return this._renderPass.globeDepthCopyPass.texture;
  }

  /**
   * Gets the globe normal texture for post-processing effects.
   */
  getGlobeNormalTexture() {
    invariant(this._renderPass, "CustomRenderPass isn't initialized yet.");
    return this._renderPass.globeNormalCopyPass.texture;
  }

  /**
   * Gets the main render target which includes G-buffer.
   */
  getRenderTarget() {
    invariant(this._renderPass, "CustomRenderPass isn't initialized yet.");
    return this._renderPass.gbufferRenderTarget;
  }

  /**
   * Gets the scene normal texture from the G-buffer.
   */
  getNormalTexture() {
    invariant(this._renderPass, "CustomRenderPass isn't initialized yet.");
    return this._renderPass.gbufferRenderTarget.textures[1];
  }

  /**
   * Gets the effect IDs texture from the G-buffer.
   */
  getEffectIdsTexture() {
    invariant(this._renderPass, "CustomRenderPass isn't initialized yet.");
    return this._renderPass.gbufferRenderTarget.textures[2];
  }

  /**
   * Gets the emissive texture from the G-buffer.
   */
  getEmissiveTexture() {
    invariant(this._renderPass, "CustomRenderPass isn't initialized yet.");
    return this._renderPass.gbufferRenderTarget.textures[3];
  }

  // --- Layer query ---

  /** @internal Iterate over all registered effect descriptors. */
  _getEffects(): Generator<EffectHandle> {
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
}
