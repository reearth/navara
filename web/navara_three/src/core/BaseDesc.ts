import { EventHandler, type BaseEventMap } from "@navara/core";
import { generateId } from "@navara/engine";

import type ThreeView from "../index";

import type { ViewContext } from "./ViewContext";

/**
 * Base configuration options common to all declaration layers.
 */
export type BaseDescConfig = {
  /** Optional custom ID for the layer. Auto-generated if not provided. */
  id?: string;
  /** Whether the layer is visible. Defaults to true. */
  visible?: boolean;
};

/**
 * Configuration properties that can be updated after layer creation.
 */
export type BaseDescConfigUpdate = Pick<BaseDescConfig, "visible">;

/**
 * Base interface for the underlying Three.js instance created by a layer.
 */
export type BaseInstance = { visible: boolean };

/**
 * Internal events emitted by BaseDesc.
 */
export type BaseDescEvents = {
  /** @internal Emitted when the layer needs to trigger a re-render. */
  needsUpdate: () => void;
};

/**
 * Abstract base class for declaration layers (mesh, light, and effect layers).
 * Extend this class to create custom layer types.
 *
 * Declaration layers differ from resource layers in that they are purely client-side
 * and don't load data from external sources. They create Three.js objects directly.
 *
 * @typeParam Config - Configuration type for the layer (extends BaseDescConfig)
 * @typeParam UpdateConfig - Configuration properties that can be updated (extends BaseDescConfigUpdate)
 * @typeParam Instance - The underlying Three.js object type created by the layer
 * @typeParam CustomEvent - Additional custom events the layer can emit
 *
 * @example
 * ```typescript
 * // Creating a custom mesh layer
 * class MyCustomMeshLayer extends BaseDesc<MyConfig, MyUpdateConfig, Mesh> {
 *   onCreate() {
 *     const geometry = new BoxGeometry(1, 1, 1);
 *     const material = new MeshBasicMaterial();
 *     this._instance = new Mesh(geometry, material);
 *     this.ctx.scenes.opaque.add(this._instance);
 *   }
 * }
 * ```
 */
export abstract class BaseDesc<
  Config extends BaseDescConfig = BaseDescConfig,
  UpdateConfig extends BaseDescConfigUpdate = BaseDescConfigUpdate,
  Instance extends BaseInstance = BaseInstance,
  CustomEvent extends BaseEventMap = BaseEventMap,
> extends EventHandler<BaseDescEvents & CustomEvent> {
  /** The unique identifier of this layer. */
  public readonly id: string;

  /** The ThreeView instance providing access to camera, atmosphere, globe, and other view state. */
  protected view: ThreeView;
  /** The view context providing access to scenes, passes, and rendering internals. */
  protected ctx: ViewContext;
  /** The underlying Three.js instance created by this layer. */
  protected _instance: Instance | undefined;

  private _visible?: boolean;

  constructor(
    view: ThreeView,
    ctx: ViewContext,
    config: Config = {} as Config,
  ) {
    super();

    this.id = config.id || generateId();
    this._visible = config.visible ?? true;
    this.view = view;
    this.ctx = ctx;
  }

  /**
   * Called when the layer is added to the scene. Override this to create the Three.js objects.
   * This is where you should initialize `this._instance` and add it to the appropriate scene.
   */
  abstract onCreate(): void;

  /**
   * Called when the layer configuration is updated via `LayerHandle.update()`.
   * Override this to handle custom configuration updates.
   * @param updates - The configuration properties being updated
   */
  onUpdateConfig(updates: UpdateConfig) {
    if (updates.visible !== undefined) {
      this._visible = updates.visible;
      if (this._instance) {
        this._instance.visible = updates.visible;
      }
    }

    this.requestUpdate();
  }

  protected requestUpdate(): void {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.emit("needsUpdate");
  }

  /**
   * Called when the layer is deleted via `LayerHandle.delete()`.
   * Override this to clean up resources. Remember to call `super.onDestroy()`.
   */
  onDestroy(): void {
    this._instance = undefined;
  }

  /**
   * Gets whether the layer is currently visible.
   */
  get visible() {
    return !!this._visible;
  }

  /**
   * Sets whether the layer should be visible.
   */
  set visible(v: boolean) {
    this._visible = v;
    this.onUpdateConfig({ visible: v } as UpdateConfig);
  }
}
