import type { BaseEventMap, XYZ } from "@navara/core";
import { Object3D, type Material } from "three";

import { setupMeshEventHandlers as setupMeshEventHandlersUtil } from "../mesh/meshEventHandlers";
import type { Scenes } from "../scene";

import {
  LayerDeclaration,
  type BaseInstance,
  type LayerDeclarationConfig,
  type LayerDeclarationConfigUpdate,
} from "./LayerDeclaration";
import type { ViewContext } from "./ViewContext";

export type MeshLayerConfig = {
  type: "mesh";
  position?: XYZ;
  scale?: XYZ;
  rotation?: XYZ;
  effects?: string[];
  selectiveDepthTest?: boolean;
} & LayerDeclarationConfig;

export type MeshLayerUpdate = Pick<
  MeshLayerConfig,
  "position" | "scale" | "rotation" | "effects" | "selectiveDepthTest"
> &
  LayerDeclarationConfigUpdate;

type PassKey = keyof Pick<
  Scenes,
  "opaque" | "transparent" | "mrt" | "skyEnvMap"
>;

export type MeshBaseInstance<Instance extends object = object> =
  Instance extends Object3D
    ? Instance
    : Instance extends {
          raw: infer Raw extends Object3D;
        }
      ? Instance & { raw: Raw } & BaseInstance
      : Instance & BaseInstance;

export abstract class MeshLayerDeclaration<
  Config extends MeshLayerConfig = MeshLayerConfig,
  UpdateConfig extends MeshLayerUpdate = MeshLayerUpdate,
  InstanceObj extends Object3D | { raw: Object3D } =
    | Object3D
    | { raw: Object3D },
  CustomEvent extends BaseEventMap = BaseEventMap,
  Instance extends
    MeshBaseInstance<InstanceObj> = MeshBaseInstance<InstanceObj>,
> extends LayerDeclaration<Config, UpdateConfig, Instance, CustomEvent> {
  public position?: XYZ;
  public scale?: XYZ;
  public rotation?: XYZ;
  private prevPassKey?: PassKey;
  private effects?: string[];
  private selectiveDepthTest?: boolean;

  constructor(view: ViewContext, config: Config = {} as Config) {
    super(view, config);
    this.position = config.position;
    this.scale = config.scale;
    this.rotation = config.rotation;
    this.effects = config.effects;
    this.selectiveDepthTest = config.selectiveDepthTest;
  }

  protected getPassKey(): PassKey {
    return "opaque";
  }

  abstract createMesh(): Instance;

  get raw() {
    if (!this._instance) return;

    if (this._instance instanceof Object3D) {
      return this._instance as Instance extends Object3D ? Instance : never;
    }
    if ("raw" in this._instance) {
      return this._instance.raw as Instance extends {
        raw: infer Raw extends Object3D;
      }
        ? Raw
        : never;
    }
    return;
  }

  onCreate() {
    this._instance = this.createMesh();

    if (this.position) {
      this.raw?.position.copy(this.position);
    }

    if (this.scale) {
      this.raw?.scale.copy(this.scale);
    }

    if (this.rotation) {
      this.raw?.rotation.set(this.rotation.x, this.rotation.y, this.rotation.z);
    }

    this._instance.visible = this.visible;

    this.onPassKeyChange();

    // Register layer effects with selectiveDepthTest setting
    if (this.effects && this.effects.length > 0) {
      this.view.registerLayerEffects(
        this.id,
        this.effects,
        this.selectiveDepthTest,
      );
    }

    // Setup mesh event handlers for all mesh types
    this.setupMeshEventHandlers();

    // Setup CSM event handlers if layer emits material lifecycle events
    this.setupCSMEventHandlers();
  }

  /**
   * Setup event handlers for primitive mesh objects.
   * This enables emissive and layerEffects control via events instead of direct manipulation.
   */
  protected setupMeshEventHandlers() {
    if (!this.raw) return;
    setupMeshEventHandlersUtil(this.raw, this.view, this.id);
  }

  /**
   * Setup CSM event handlers for material lifecycle management.
   * This method is called automatically in onCreate() and listens for
   * materialCreated and materialDisposed events from child layers.
   */
  private setupCSMEventHandlers() {
    // Type-safe check if the layer has CSM-related events
    const hasCSMEvents =
      "on" in this && typeof this.on === "function" && "emit" in this;

    if (hasCSMEvents) {
      // Listen for materialCreated event
      try {
        // @ts-expect-error - Dynamic event listening for CSM support
        this.on("materialCreated", (material: Material) => {
          this.view.emit("_csmMounted", material);
        });
      } catch {
        // Layer doesn't emit materialCreated, skip
      }

      // Listen for materialDisposed event
      try {
        // @ts-expect-error - Dynamic event listening for CSM support
        this.on("materialDisposed", (material: Material) => {
          this.view.emit("_csmUnmounted", material);
        });
      } catch {
        // Layer doesn't emit materialDisposed, skip
      }
    }
  }

  removeFromScene(passKey: PassKey) {
    const scenes = this.view.scenes;

    if (scenes[passKey] && this.raw) {
      scenes[passKey].remove(this.raw);
    }
  }

  addToScene(passKey: PassKey) {
    if (!this.raw) return;

    const scenes = this.view.scenes;

    if (scenes[passKey]) {
      scenes[passKey].add(this.raw);
    }
  }

  onUpdateConfig(updates: UpdateConfig): void {
    super.onUpdateConfig(updates);

    if (updates.position !== undefined) {
      this.position = updates.position;
      this.raw?.position.copy(updates.position);
    }

    if (updates.scale !== undefined) {
      this.scale = updates.scale;
      this.raw?.scale.copy(updates.scale);
    }

    if (updates.rotation !== undefined) {
      this.rotation = updates.rotation;
      this.raw?.rotation.set(
        updates.rotation.x,
        updates.rotation.y,
        updates.rotation.z,
      );
    }

    // Handle effects update - delegate to ViewContext for proper cache synchronization
    if (updates.effects !== undefined) {
      // Update local effects cache (for backward compatibility)
      this.effects = updates.effects.length > 0 ? updates.effects : undefined;

      // Delegate to ViewContext to handle all effect updates, including:
      // - layerEffects cache update
      // - SelectiveEffectRegistry linking/unlinking
      // - Event dispatching to mesh objects
      this.view.updateLayerEffects(this.id, updates.effects);
    }

    // Handle selectiveDepthTest update - always delegate to ViewContext for consistency
    if (updates.selectiveDepthTest !== undefined) {
      this.selectiveDepthTest = updates.selectiveDepthTest;
      // Use ViewContext API to ensure all layers (including MeshLayerDeclaration) follow same pipeline:
      // 1. SelectiveEffectRegistry settings are updated
      // 2. Existing clones are moved between sceneDepthEnabled/sceneDepthDisabled
      // This ensures Cube/Sphere behave consistently with Layer types
      this.view.setLayerSelectiveDepthTest(this.id, this.selectiveDepthTest);
    }

    this.onPassKeyChange();
  }

  onPassKeyChange() {
    const nextPassKey = this.getPassKey();
    if (this.prevPassKey === nextPassKey) return;
    if (this.prevPassKey) {
      this.removeFromScene(this.prevPassKey);
    }
    this.prevPassKey = nextPassKey;
    this.addToScene(nextPassKey);
  }

  onDestroy(): void {
    if (this.raw && this.raw.parent) {
      this.raw.parent.remove(this.raw);
    }

    super.onDestroy();
  }

  // ==========================================
  // Effect Management Methods
  // ==========================================
  // These methods now use ViewContext as the single source of truth,
  // ensuring proper synchronization with SelectiveEffectRegistry

  /**
   * Enable a specific effect for this layer
   * @param effectId - The ID of the effect to enable
   */
  enableEffect(effectId: string): void {
    const current = this.view.getLayerEffects(this.id) ?? [];
    if (!current.includes(effectId)) {
      this.view.updateLayerEffects(this.id, [...current, effectId]);
    }
  }

  /**
   * Disable a specific effect for this layer
   * @param effectId - The ID of the effect to disable
   */
  disableEffect(effectId: string): void {
    const current = this.view.getLayerEffects(this.id) ?? [];
    const updated = current.filter((id) => id !== effectId);
    this.view.updateLayerEffects(this.id, updated);
  }

  /**
   * Toggle a specific effect for this layer
   * @param effectId - The ID of the effect to toggle
   * @param enabled - Optional explicit state. If not provided, toggles current state
   */
  toggleEffect(effectId: string, enabled?: boolean): void {
    const shouldEnable = enabled ?? !this.hasEffect(effectId);
    if (shouldEnable) {
      this.enableEffect(effectId);
    } else {
      this.disableEffect(effectId);
    }
  }

  /**
   * Check if this layer has a specific effect enabled
   * @param effectId - The ID of the effect to check
   * @returns true if the effect is enabled
   */
  hasEffect(effectId: string): boolean {
    const effects = this.view.getLayerEffects(this.id) ?? [];
    return effects.includes(effectId);
  }

  /**
   * Get all currently active effects for this layer
   * @returns Array of effect IDs
   */
  getEffects(): string[] {
    return this.view.getLayerEffects(this.id) ?? [];
  }

  /**
   * Set all effects for this layer, replacing any existing effects
   * @param effectIds - Array of effect IDs to set
   */
  setEffects(effectIds: string[]): void {
    this.view.updateLayerEffects(this.id, effectIds);
  }

  /**
   * Clear all effects from this layer
   */
  clearEffects(): void {
    this.view.updateLayerEffects(this.id, []);
  }

  /**
   * Set selective depth test for this layer
   * @param enabled - Whether to enable depth test for selective effects
   */
  setSelectiveDepthTest(enabled: boolean): void {
    this.view.setLayerSelectiveDepthTest(this.id, enabled);
  }

  /**
   * Get the current selective depth test setting for this layer
   * @returns The current selective depth test setting
   */
  getSelectiveDepthTest(): boolean {
    return this.view.getLayerSelectiveDepthTest(this.id);
  }

  /**
   * Set emissive color for this layer
   * @param color - The emissive color as a hex number (e.g., 0xffffff), or undefined to use material color
   */
  setEmissiveColor(color: number | undefined): void {
    this.view.setLayerEmissiveColor(this.id, color);
  }

  /**
   * Get the current emissive color for this layer
   * @returns The current emissive color, or undefined if using material color
   */
  getEmissiveColor(): number | undefined {
    return this.view.getLayerEmissiveColor(this.id);
  }

  update?(time: number): void;

  onResize?(width: number, height: number): void;
}
