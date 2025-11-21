import {
  Scene,
  WebGLRenderTarget,
  RGBAFormat,
  Object3D,
  Mesh,
  WebGLRenderer,
  DoubleSide,
} from "three";

import { BufferView } from "../bufferView";

export type SelectiveEffectOptions = {
  resolutionScale?: number;
  debugMask?: boolean;
};

export type SelectiveEffectResources = {
  scene: Scene; // Legacy scene for compatibility
  sceneDepthEnabled: Scene; // Scene for objects with selectiveDepthTest enabled
  sceneDepthDisabled: Scene; // Scene for objects with selectiveDepthTest disabled
  maskRT: WebGLRenderTarget;
  highlightRT: WebGLRenderTarget; // Legacy render target for compatibility
  objects: WeakMap<Object3D, Object3D>; // source -> clone
  objectLayerMap: Map<string, string>; // sourceId -> layerId cache
  sourceMap: Map<string, Object3D>; // sourceId -> source object cache
  cloneMap: Map<string, Object3D>; // sourceId -> clone cache
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
  private layerSelectiveDepthSettings = new Map<string, boolean>();
  private layerKeepClones = new Map<string, boolean>();

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

    // Legacy scene for compatibility (not actively used)
    const scene = new Scene();
    scene.name = `SelectiveEffect_${effectId}`;

    const sceneDepthEnabled = new Scene();
    sceneDepthEnabled.name = `SelectiveEffect_${effectId}_DepthEnabled`;

    const sceneDepthDisabled = new Scene();
    sceneDepthDisabled.name = `SelectiveEffect_${effectId}_DepthDisabled`;

    // Mark scenes so we can detect selective mask rendering in onBeforeRender
    // and differentiate depth test behavior between them.
    (
      sceneDepthEnabled.userData as {
        selectiveMask?: { enabled: boolean; depthTest: boolean };
      }
    ).selectiveMask = { enabled: true, depthTest: true };
    (
      sceneDepthDisabled.userData as {
        selectiveMask?: { enabled: boolean; depthTest: boolean };
      }
    ).selectiveMask = { enabled: true, depthTest: false };

    const maskRT = new WebGLRenderTarget(width, height, {
      format: RGBAFormat,
      depthBuffer: true,
      stencilBuffer: true,
    });
    maskRT.texture.name = `SelectiveMask_${effectId}`;

    // Legacy render target for compatibility (not actively used)
    const highlightRT = new WebGLRenderTarget(width, height, {
      format: RGBAFormat,
      depthBuffer: true,
      stencilBuffer: true,
    });
    highlightRT.texture.name = `SelectiveHighlight_${effectId}`;

    const objects = new WeakMap<Object3D, Object3D>();
    const objectLayerMap = new Map<string, string>();
    const sourceMap = new Map<string, Object3D>();
    const cloneMap = new Map<string, Object3D>();

    let maskDebug: BufferView | undefined;
    if (options.debugMask) {
      maskDebug = new BufferView(width, height);
    }

    const resources: SelectiveEffectResources = {
      scene,
      sceneDepthEnabled,
      sceneDepthDisabled,
      maskRT,
      highlightRT,
      objects,
      objectLayerMap,
      sourceMap,
      cloneMap,
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
   * Register selective depth test setting for a layer
   */
  registerLayerSelectiveDepthTest(
    layerId: string,
    selectiveDepthTest: boolean,
  ): void {
    this.layerSelectiveDepthSettings.set(layerId, selectiveDepthTest);
  }

  /**
   * Get selective depth test setting for a layer
   */
  getLayerSelectiveDepthTest(layerId: string): boolean {
    return this.layerSelectiveDepthSettings.get(layerId) ?? true;
  }

  /**
   * Update selective depth test for all clones of a layer
   * Moves clones between sceneDepthEnabled and sceneDepthDisabled
   * Optimized to only process clones that actually need to move
   */
  updateLayerSelectiveDepthTest(
    layerId: string,
    selectiveDepthTest: boolean,
  ): void {
    // Check if value actually changed (should already be checked in ViewContext, but double-check)
    const currentSetting = this.layerSelectiveDepthSettings.get(layerId);
    if (currentSetting === selectiveDepthTest) {
      return; // No change, skip processing
    }

    // Update the setting
    this.layerSelectiveDepthSettings.set(layerId, selectiveDepthTest);

    // Move clones for this layer between scenes (optimized: only affected clones)
    for (const resources of this.resources.values()) {
      // Collect sourceIds for this layer to minimize Map iterations
      const affectedSourceIds: string[] = [];
      for (const [
        sourceId,
        mappedLayerId,
      ] of resources.objectLayerMap.entries()) {
        if (mappedLayerId === layerId) {
          affectedSourceIds.push(sourceId);
        }
      }

      // Process only affected clones
      for (const sourceId of affectedSourceIds) {
        const clone = resources.cloneMap.get(sourceId);
        if (!clone) continue;

        // Re-attach clone to appropriate scene based on new depth test setting
        this.attachCloneToScene(resources, clone, layerId);
      }
    }
  }

  private forEachMesh(object: Object3D, callback: (mesh: Mesh) => void): void {
    object.traverse((child) => {
      if (child instanceof Mesh) {
        callback(child);
      }
    });
  }

  private syncCloneTransform(source: Mesh, clone: Mesh): void {
    clone.visible = source.visible;
    clone.renderOrder = source.renderOrder;
    clone.castShadow = source.castShadow;
    clone.receiveShadow = source.receiveShadow;
    clone.material = source.material;
    clone.position.setFromMatrixPosition(source.matrixWorld);
    clone.rotation.setFromRotationMatrix(source.matrixWorld);
    clone.scale.setFromMatrixScale(source.matrixWorld);
    clone.updateMatrixWorld(true);
  }

  private attachCloneToScene(
    resources: SelectiveEffectResources,
    clone: Object3D,
    layerId?: string,
  ): void {
    if (!layerId) return;

    const depthTest = this.getLayerSelectiveDepthTest(layerId);

    // Ensure clones are detached from both scenes before re-attaching.
    resources.sceneDepthEnabled.remove(clone);
    resources.sceneDepthDisabled.remove(clone);

    if (depthTest) {
      resources.sceneDepthEnabled.add(clone);
    } else {
      resources.sceneDepthDisabled.add(clone);
    }
  }

  link(effectId: string, sourceObject: Object3D, layerId?: string): void {
    const resources = this.resources.get(effectId);
    if (!resources) {
      console.warn(`Selective effect ${effectId} not found`);
      return;
    }

    const selectiveMaskBeforeRender = (
      _renderer: WebGLRenderer,
      scene: Scene,
      _camera: Object3D,
      _geometry: unknown,
      material: unknown,
    ) => {
      const maskInfo = (
        scene.userData as {
          selectiveMask?: { enabled: boolean; depthTest: boolean };
        }
      ).selectiveMask;
      if (!maskInfo?.enabled) return;

      const meshMaterial = material as {
        color?: { set: (color: number) => void };
        emissive?: { set: (color: number) => void };
        depthTest?: boolean;
        depthWrite?: boolean;
        side?: number;
        transparent?: boolean;
        opacity?: number;
        userData?: Record<string, unknown>;
      };

      meshMaterial.userData ??= {};
      const store = (
        meshMaterial.userData as {
          __selectivePrevState?: {
            color?: unknown;
            emissive?: unknown;
            depthTest?: boolean;
            depthWrite?: boolean;
            side?: number;
            transparent?: boolean;
            opacity?: number;
            active?: boolean;
          };
        }
      ).__selectivePrevState ?? {
        active: false,
      };

      if (!store.active) {
        if ("color" in meshMaterial && meshMaterial.color) {
          store.color = meshMaterial.color;
        }
        if ("emissive" in meshMaterial && meshMaterial.emissive) {
          store.emissive = meshMaterial.emissive;
        }
        store.depthTest = meshMaterial.depthTest;
        store.depthWrite = meshMaterial.depthWrite;
        store.side = meshMaterial.side;
        store.transparent = meshMaterial.transparent;
        store.opacity = meshMaterial.opacity;
        store.active = true;
        (
          meshMaterial.userData as { __selectivePrevState?: typeof store }
        ).__selectivePrevState = store;
      }

      if (meshMaterial.color) {
        meshMaterial.color.set(0xffffff);
      }
      if (meshMaterial.emissive) {
        meshMaterial.emissive.set(0x000000);
      }
      meshMaterial.depthTest = maskInfo.depthTest;
      meshMaterial.depthWrite = true;
      meshMaterial.side = DoubleSide;
      meshMaterial.transparent = false;
      meshMaterial.opacity = 1.0;
    };

    const selectiveMaskAfterRender = (
      _renderer: WebGLRenderer,
      scene: Scene,
      _camera: Object3D,
      _geometry: unknown,
      material: unknown,
    ) => {
      const maskInfo = (
        scene.userData as {
          selectiveMask?: { enabled: boolean; depthTest: boolean };
        }
      ).selectiveMask;
      if (!maskInfo?.enabled) return;

      const meshMaterial = material as {
        color?: { copy: (color: unknown) => void };
        emissive?: { copy: (color: unknown) => void };
        depthTest?: boolean;
        depthWrite?: boolean;
        side?: number;
        transparent?: boolean;
        opacity?: number;
        userData?: {
          __selectivePrevState?: {
            color?: unknown;
            emissive?: unknown;
            depthTest?: boolean;
            depthWrite?: boolean;
            side?: number;
            transparent?: boolean;
            opacity?: number;
            active?: boolean;
          };
        };
      };

      const store = meshMaterial.userData?.__selectivePrevState;
      if (!store?.active) return;

      if (meshMaterial.color && store.color) {
        meshMaterial.color.copy(store.color);
      }
      if (meshMaterial.emissive && store.emissive) {
        meshMaterial.emissive.copy(store.emissive);
      }
      if (store.depthTest !== undefined) {
        meshMaterial.depthTest = store.depthTest;
      }
      if (store.depthWrite !== undefined) {
        meshMaterial.depthWrite = store.depthWrite;
      }
      if (store.side !== undefined) {
        meshMaterial.side = store.side;
      }
      if (store.transparent !== undefined) {
        meshMaterial.transparent = store.transparent;
      }
      if (store.opacity !== undefined) {
        meshMaterial.opacity = store.opacity;
      }

      store.active = false;
    };

    // Ensure world matrices are up to date before traversing children
    sourceObject.updateMatrixWorld(true);

    const linkMesh = (mesh: Mesh) => {
      const existing = resources.objects.get(mesh);
      const mappedLayerId = resources.objectLayerMap.get(mesh.uuid) ?? layerId;

      if (existing) {
        // Refresh existing clone state - validate both are Mesh instances
        if (existing instanceof Mesh) {
          this.syncCloneTransform(mesh, existing);
          if (mappedLayerId) {
            resources.objectLayerMap.set(mesh.uuid, mappedLayerId);
          }
          resources.sourceMap.set(mesh.uuid, mesh);
          resources.cloneMap.set(mesh.uuid, existing);
          this.attachCloneToScene(resources, existing, mappedLayerId);
        }
        return;
      }

      const clone = mesh.clone();
      clone.userData.isSelectiveClone = true;
      clone.userData.sourceId = mesh.uuid;

      // Attach selective mask hooks to clones so we can override only for
      // selective mask scenes without touching original mesh materials.
      if (!clone.onBeforeRender) {
        clone.onBeforeRender = selectiveMaskBeforeRender as never;
      }
      if (!clone.onAfterRender) {
        clone.onAfterRender = selectiveMaskAfterRender as never;
      }

      // Copy world space transform so detached clone renders correctly
      clone.position.setFromMatrixPosition(mesh.matrixWorld);
      clone.rotation.setFromRotationMatrix(mesh.matrixWorld);
      clone.scale.setFromMatrixScale(mesh.matrixWorld);
      clone.visible = mesh.visible;

      clone.renderOrder = mesh.renderOrder;
      clone.castShadow = mesh.castShadow;
      clone.receiveShadow = mesh.receiveShadow;

      // Share material reference to keep uniforms/settings in sync
      clone.material = mesh.material;

      resources.objects.set(mesh, clone);
      resources.sourceMap.set(mesh.uuid, mesh);
      resources.cloneMap.set(mesh.uuid, clone);

      const cacheLayerId = mappedLayerId ?? layerId;
      if (cacheLayerId) {
        resources.objectLayerMap.set(mesh.uuid, cacheLayerId);
        this.attachCloneToScene(resources, clone, cacheLayerId);
      }

      clone.updateMatrixWorld(true);
    };

    this.forEachMesh(sourceObject, linkMesh);
  }

  /**
   * Unlink an object from a selective effect
   */
  unlink(effectId: string, sourceObject: Object3D): void {
    const resources = this.resources.get(effectId);
    if (!resources) {
      return;
    }

    const unlinkMesh = (mesh: Mesh) => {
      const clone = resources.objects.get(mesh);
      if (!clone) {
        return;
      }

      resources.sceneDepthEnabled.remove(clone);
      resources.sceneDepthDisabled.remove(clone);

      const mappedLayerId = resources.objectLayerMap.get(mesh.uuid);
      const keepClones = mappedLayerId && this.shouldKeepClones(mappedLayerId);

      if (keepClones) {
        clone.visible = false;
      } else {
        resources.objects.delete(mesh);
        resources.objectLayerMap.delete(mesh.uuid);
        resources.sourceMap.delete(mesh.uuid);
        resources.cloneMap.delete(mesh.uuid);
      }
    };

    this.forEachMesh(sourceObject, unlinkMesh);
  }

  /**
   * Sync transform/visibility from source to clone
   */
  syncObject(sourceObject: Object3D): void {
    sourceObject.updateMatrixWorld(true);

    const meshes: Mesh[] = [];
    this.forEachMesh(sourceObject, (mesh) => {
      meshes.push(mesh);
    });

    for (const resources of this.resources.values()) {
      const syncMesh = (mesh: Mesh) => {
        const clone = resources.objects.get(mesh);
        if (!clone || !(clone instanceof Mesh)) {
          return;
        }

        this.syncCloneTransform(mesh, clone);
      };

      for (const mesh of meshes) {
        syncMesh(mesh);
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

    // Clear scenes
    resources.scene.clear();
    resources.sceneDepthEnabled.clear();
    resources.sceneDepthDisabled.clear();

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

  registerLayerKeepClones(
    layerId: string,
    keepClones: boolean | undefined,
  ): void {
    if (keepClones) {
      this.layerKeepClones.set(layerId, true);
    } else {
      this.layerKeepClones.delete(layerId);
      this.cleanupLayerClones(layerId);
    }
  }

  shouldKeepClones(layerId: string): boolean {
    return this.layerKeepClones.get(layerId) ?? false;
  }

  private cleanupLayerClones(layerId: string): void {
    for (const resources of this.resources.values()) {
      for (const [sourceId, mappedLayerId] of Array.from(
        resources.objectLayerMap.entries(),
      )) {
        if (mappedLayerId !== layerId) continue;

        const clone = resources.cloneMap.get(sourceId);
        if (clone) {
          resources.sceneDepthEnabled.remove(clone);
          resources.sceneDepthDisabled.remove(clone);
          resources.cloneMap.delete(sourceId);
        }

        const source = resources.sourceMap.get(sourceId);
        if (source) {
          resources.objects.delete(source);
          resources.sourceMap.delete(sourceId);
        }

        resources.objectLayerMap.delete(sourceId);
      }
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
