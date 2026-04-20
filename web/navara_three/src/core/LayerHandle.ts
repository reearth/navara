import { EventHandler } from "@navara/core";

import { BaseDesc, type BaseDescConfigUpdate } from "./BaseDesc";
import type { EffectDesc } from "./EffectDesc";
import type { LightDesc } from "./LightDesc";
import type { MeshDesc } from "./MeshDesc";

/**
 * Events emitted by handles.
 */
export type LayerHandleEvent = {
  /** Emitted when the layer is deleted. */
  deleted: () => void;
};

/**
 * Abstract base handle to control a declaration layer after it has been added to the scene.
 *
 * Use the typed subclasses instead:
 * - {@link MeshHandle} - returned by `ThreeView.addMesh()`
 * - {@link LightHandle} - returned by `ThreeView.addLight()`
 * - {@link EffectHandle} - returned by `ThreeView.addEffect()`
 *
 * @typeParam T - The specific layer declaration type
 */
export class BaseHandle<
  T extends BaseDesc = BaseDesc,
> extends EventHandler<LayerHandleEvent> {
  constructor(private layer: T) {
    super();
  }

  /**
   * Updates the layer configuration with partial updates.
   * Only the specified properties will be changed; others remain unchanged.
   * @param updates - Partial configuration object with properties to update
   */
  update(
    updates: T extends BaseDesc<infer _A, infer B> ? B : BaseDescConfigUpdate,
  ): void {
    this.layer.onUpdateConfig(updates);
  }

  /**
   * Gets direct access to the underlying layer instance.
   * Use this to access layer-specific methods and properties not exposed through the handle.
   */
  get ref(): T {
    return this.layer;
  }

  /**
   * Removes the layer from the scene and disposes its resources.
   * After calling this, the handle should no longer be used.
   */
  delete(): void {
    if (this._deleted) return;
    this._deleted = true;
    this.layer.onDestroy();
    this.emit("deleted");
  }

  private _deleted = false;

  /**
   * Gets the unique identifier of this layer.
   */
  get id(): string {
    return this.layer.id;
  }

  /**
   * Gets whether the layer is currently visible in the scene.
   */
  get visible(): boolean {
    return this.layer.visible;
  }

  /**
   * Sets whether the layer should be visible in the scene.
   * @param visible - True to show the layer, false to hide it
   */
  set visible(visible: boolean) {
    this.layer.visible = visible;
  }
}

/**
 * A handle to control a mesh layer after it has been added to the scene.
 * Returned by `ThreeView.addMesh()`.
 *
 * @typeParam T - The specific mesh declaration type (e.g., BoxMeshDesc)
 *
 * @example
 * ```typescript
 * const handle = view.addMesh<BoxMeshDesc>({ box: { width: 100 } });
 * handle.update({ box: { width: 200 } });
 * handle.delete();
 * ```
 */
export class MeshHandle<T extends MeshDesc = MeshDesc> extends BaseHandle<T> {}

/**
 * A handle to control a light layer after it has been added to the scene.
 * Returned by `ThreeView.addLight()`.
 *
 * @typeParam T - The specific light declaration type (e.g., SunLightDesc)
 */
export class LightHandle<
  T extends LightDesc = LightDesc,
> extends BaseHandle<T> {}

/**
 * A handle to control an effect layer after it has been added to the scene.
 * Returned by `ThreeView.addEffect()`.
 *
 * @typeParam T - The specific effect declaration type (e.g., SSAOEffectDesc)
 */
export class EffectHandle<
  T extends EffectDesc = EffectDesc,
> extends BaseHandle<T> {}
