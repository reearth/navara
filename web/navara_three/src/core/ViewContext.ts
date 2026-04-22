import { EventHandler } from "@navara/core";
import type { Core } from "@navara/engine";
import type { ConcurrencyManager } from "@navara/worker";
import type { Pass as PostProcessingPass } from "postprocessing";
import type { Material, Object3D, WebGLRenderer } from "three";
import invariant from "tiny-invariant";

import type { LayersManager } from "../layersManager";
import type { PickableMesh } from "../mesh/pickableMesh";
import type { RenderPassOrchestrator } from "../orchestrators";
import type { CustomRenderPass } from "../passes";
import type { Scenes } from "../scene";
import type { MeshCache } from "../type";

import type { EffectLayerDeclaration } from "./EffectLayerDeclaration";
import type { LayerHandle } from "./LayerHandle";
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
  private _selectiveEffectRegistry: SelectiveEffectRegistry;
  private _renderPass?: CustomRenderPass;

  constructor(
    /** Scene containers for different rendering passes. */
    private _scenes: Scenes,
    private layersManager: LayersManager,
    private renderPassOrchestrator: RenderPassOrchestrator,
    /** Manager for scheduling work on Web Workers. */
    private _concurrencyManager: ConcurrencyManager,
    private _core: Core,
    private _meshes: MeshCache,
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

  // --- Picking registration ---

  /**
   * Generate a new unique global batch ID for picking.
   * The returned ID is in the 24-bit RGB color range (1..0xffffff).
   */
  genGlobalBatchId(): number | undefined {
    return this._core?.genGlobalBatchId();
  }

  /**
   * Register a pickable mesh so the picking system can discover it.
   * @param key - Unique key (typically the layer ID).
   * @param mesh - Any {@link PickableMesh} implementation. Implementers
   *   must also be an `Object3D` so the pick pass can re-parent the
   *   renderable into its dedicated scene.
   */
  registerPickableMesh(key: string, mesh: PickableMesh & Object3D): void {
    this._meshes?.set(key, mesh);
  }

  /**
   * Unregister a pickable mesh from the picking system.
   * @param key - The key used during registration.
   */
  unregisterPickableMesh(key: string): void {
    this._meshes?.delete(key);
  }
}
