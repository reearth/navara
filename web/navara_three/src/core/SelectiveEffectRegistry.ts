import {
  Scene,
  WebGLRenderTarget,
  RGBAFormat,
  Object3D,
  Mesh,
  WebGLRenderer,
} from "three";

import { BufferView } from "../bufferView";

export type SelectiveEffectOptions = {
  resolutionScale?: number;
  debugMask?: boolean;
};

export type SelectiveEffectResources = {
  scene: Scene;
  maskRT: WebGLRenderTarget;
  highlightRT: WebGLRenderTarget;
  objects: WeakMap<Object3D, Object3D>; // source -> clone
  options: SelectiveEffectOptions;
  maskDebug?: BufferView;
};

/**
 * Registry for managing selective effect resources
 * Each effect gets its own Scene and render targets
 */
export class SelectiveEffectRegistry {
  private resources = new Map<string, SelectiveEffectResources>();
  private width: number;
  private height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /**
   * Create resources for a selective effect
   */
  create(
    effectId: string,
    options: SelectiveEffectOptions = {},
  ): SelectiveEffectResources {
    if (this.resources.has(effectId)) {
      throw new Error(`Selective effect ${effectId} already exists`);
    }

    const resolutionScale = options.resolutionScale ?? 1.0;
    const width = Math.floor(this.width * resolutionScale);
    const height = Math.floor(this.height * resolutionScale);

    const scene = new Scene();
    scene.name = `SelectiveEffect_${effectId}`;

    const maskRT = new WebGLRenderTarget(width, height, {
      format: RGBAFormat,
      depthBuffer: true,
      stencilBuffer: true,
    });
    maskRT.texture.name = `SelectiveMask_${effectId}`;

    const highlightRT = new WebGLRenderTarget(width, height, {
      format: RGBAFormat,
      depthBuffer: true,
      stencilBuffer: true,
    });
    highlightRT.texture.name = `SelectiveHighlight_${effectId}`;

    const objects = new WeakMap<Object3D, Object3D>();

    let maskDebug: BufferView | undefined;
    if (options.debugMask) {
      maskDebug = new BufferView(width, height);
    }

    const resources: SelectiveEffectResources = {
      scene,
      maskRT,
      highlightRT,
      objects,
      options,
      maskDebug,
    };

    this.resources.set(effectId, resources);

    return resources;
  }

  /**
   * Get resources for an effect
   */
  get(effectId: string): SelectiveEffectResources | undefined {
    return this.resources.get(effectId);
  }

  /**
   * Link an object to a selective effect by creating a clone
   */
  link(effectId: string, sourceObject: Object3D): void {
    const resources = this.resources.get(effectId);
    if (!resources) {
      console.warn(`Selective effect ${effectId} not found`);
      return;
    }

    // Only support Mesh for now
    if (!(sourceObject instanceof Mesh)) {
      return;
    }

    // Check if already linked
    if (resources.objects.has(sourceObject)) {
      return;
    }

    // Clone the mesh
    const clone = sourceObject.clone();
    clone.userData.isSelectiveClone = true;
    clone.userData.sourceId = sourceObject.uuid;

    // Use world position/rotation/scale for clones
    // This ensures child meshes of ModelMesh appear at correct locations
    clone.position.setFromMatrixPosition(sourceObject.matrixWorld);
    clone.rotation.setFromRotationMatrix(sourceObject.matrixWorld);
    clone.scale.setFromMatrixScale(sourceObject.matrixWorld);
    clone.visible = sourceObject.visible;

    // Copy render properties to preserve depth relationships
    clone.renderOrder = sourceObject.renderOrder;
    clone.castShadow = sourceObject.castShadow;
    clone.receiveShadow = sourceObject.receiveShadow;

    // Sync material
    clone.material = sourceObject.material;

    resources.objects.set(sourceObject, clone);
    resources.scene.add(clone);

    // Update world matrix after adding to scene
    clone.updateMatrixWorld(true);
  }

  /**
   * Unlink an object from a selective effect
   */
  unlink(effectId: string, sourceObject: Object3D): void {
    const resources = this.resources.get(effectId);
    if (!resources) {
      return;
    }

    const clone = resources.objects.get(sourceObject);
    if (clone) {
      resources.scene.remove(clone);
      resources.objects.delete(sourceObject);
    }
  }

  /**
   * Sync transform/visibility from source to clone
   */
  syncObject(sourceObject: Object3D): void {
    for (const resources of this.resources.values()) {
      const clone = resources.objects.get(sourceObject);
      if (clone) {
        // Sync transform
        clone.position.copy(sourceObject.position);
        clone.rotation.copy(sourceObject.rotation);
        clone.scale.copy(sourceObject.scale);
        clone.visible = sourceObject.visible;

        // Sync material if both are Mesh
        if (sourceObject instanceof Mesh && clone instanceof Mesh) {
          clone.material = sourceObject.material;
        }
      }
    }
  }

  /**
   * Resize render targets
   */
  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;

    for (const resources of this.resources.values()) {
      const resolutionScale = resources.options.resolutionScale ?? 1.0;
      const w = Math.floor(width * resolutionScale);
      const h = Math.floor(height * resolutionScale);

      resources.maskRT.setSize(w, h);
      resources.highlightRT.setSize(w, h);

      // Recreate debug view if enabled
      if (resources.options.debugMask) {
        resources.maskDebug?.dispose();
        resources.maskDebug = new BufferView(w, h);
      }
    }
  }

  /**
   * Destroy resources for an effect
   */
  destroy(effectId: string): void {
    const resources = this.resources.get(effectId);
    if (!resources) {
      return;
    }

    // Clear scene
    resources.scene.clear();

    // Dispose render targets
    resources.maskRT.dispose();
    resources.highlightRT.dispose();

    // Dispose debug view
    resources.maskDebug?.dispose();

    this.resources.delete(effectId);
  }

  /**
   * Destroy all resources
   */
  dispose(): void {
    for (const effectId of Array.from(this.resources.keys())) {
      this.destroy(effectId);
    }
  }

  /**
   * Render debug buffer views for all selective effects
   */
  renderDebugViews(renderer: WebGLRenderer): void {
    for (const resources of this.resources.values()) {
      if (!resources.maskDebug) continue;
      resources.maskDebug.render(renderer, resources.maskRT);
    }
  }
}
