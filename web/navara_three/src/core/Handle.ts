import { EventHandler } from "@navara/core";

import {
  Declaration,
  type DeclarationConfigUpdate,
} from "./Declaration";

/**
 * Events emitted by Handle.
 */
export type HandleEvent = {
  /** Emitted when the layer is deleted. */
  deleted: () => void;
};

/**
 * A handle to control a declaration layer (mesh, light, or effect layer) after it has been added to the scene.
 * Returned by `ThreeView.addLayer()` when adding mesh, light, or effect layers.
 *
 * Use this handle to update layer properties, control visibility, or delete the layer.
 *
 * @typeParam T - The specific layer declaration type (e.g., SkyMeshDeclaration, SunLightDeclaration)
 *
 * @example
 * ```typescript
 * // Add a sky mesh layer and get a handle
 * const skyHandle = view.addMesh<SkyMeshDeclaration>({ type: "sky" });
 *
 * // Update the layer configuration
 * skyHandle.update({ sunAngularRadius: 0.05 });
 *
 * // Toggle visibility
 * skyHandle.visible = false;
 *
 * // Access the underlying layer instance
 * const skyLayer = skyHandle.ref;
 *
 * // Delete the layer when no longer needed
 * skyHandle.delete();
 * ```
 */
export class Handle<
  T extends Declaration = Declaration,
> extends EventHandler<HandleEvent> {
  constructor(private layer: T) {
    super();
  }

  /**
   * Updates the layer configuration with partial updates.
   * Only the specified properties will be changed; others remain unchanged.
   * @param updates - Partial configuration object with properties to update
   */
  update(
    updates: T extends Declaration<infer _A, infer B>
      ? B
      : DeclarationConfigUpdate,
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
    this.layer.onDestroy();
  }

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
