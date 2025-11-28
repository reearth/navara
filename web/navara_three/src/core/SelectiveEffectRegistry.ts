import {
  Scene,
  WebGLRenderTarget,
  RGBAFormat,
  Object3D,
  Mesh,
  WebGLRenderer,
  DoubleSide,
  MeshStandardMaterial,
  MeshPhysicalMaterial,
} from "three";

import { BufferView } from "../bufferView";

export type PostEffectOptions = {
  resolutionScale?: number;
  debugMask?: boolean;
};

export type PostEffectResources = {
  scene: Scene; // Legacy scene for compatibility
  sceneDepthEnabled: Scene; // Scene for objects with postEffectOcclusion enabled
  sceneDepthDisabled: Scene; // Scene for objects with postEffectOcclusion disabled
  maskRT: WebGLRenderTarget;
  highlightRT: WebGLRenderTarget; // Legacy render target for compatibility
  objects: WeakMap<Object3D, Object3D>; // source -> clone
  objectLayerMap: Map<string, string>; // sourceId -> layerId cache
  sourceMap: Map<string, Object3D>; // sourceId -> source object cache
  cloneMap: Map<string, Object3D>; // sourceId -> clone cache
  options: PostEffectOptions;
  maskDebug?: BufferView;
};

// Mask rendering hook: temporarily overrides material state based on scene.userData.postEffectMask
export const postEffectMaskBeforeRender = (
  _renderer: WebGLRenderer,
  scene: Scene,
  _camera: Object3D,
  _geometry: unknown,
  material: unknown,
) => {
  const maskInfo = (
    scene.userData as {
      postEffectMask?: { enabled: boolean; depthTest: boolean };
    }
  ).postEffectMask;
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
      __postEffectPrevState?: {
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
  ).__postEffectPrevState ?? {
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
      meshMaterial.userData as { __postEffectPrevState?: typeof store }
    ).__postEffectPrevState = store;
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

// Mask rendering hook: restores material state from userData.__postEffectPrevState
export const postEffectMaskAfterRender = (
  _renderer: WebGLRenderer,
  scene: Scene,
  _camera: Object3D,
  _geometry: unknown,
  material: unknown,
) => {
  const maskInfo = (
    scene.userData as {
      postEffectMask?: { enabled: boolean; depthTest: boolean };
    }
  ).postEffectMask;
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
      __postEffectPrevState?: {
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

  const store = meshMaterial.userData?.__postEffectPrevState;
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

export type EmissiveParams = {
  emissiveIntensity: number;
  emissiveColor?: number;
};

export function applyEmissiveEffect(
  material: MeshStandardMaterial | MeshPhysicalMaterial,
  params: EmissiveParams,
): void {
  const { emissiveIntensity, emissiveColor } = params;

  if (emissiveColor !== undefined) {
    material.emissive.set(emissiveColor);
  } else {
    material.emissive.copy(material.color);
  }

  material.emissiveIntensity = emissiveIntensity;
}

export function updatePostEffectLinksForObject(
  target: Object3D,
  registry: PostEffectRegistry | undefined,
  effectIds: string[],
  prevEffectIds: string[],
  layerId: string,
): void {
  if (!registry) return;

  // Unlink removed effects
  for (const effectId of prevEffectIds) {
    if (!effectIds.includes(effectId)) {
      registry.unlink(effectId, target);
    }
  }

  // Update world matrix if needed for new links
  const needsLink = effectIds.some(
    (effectId) => !prevEffectIds.includes(effectId),
  );
  if (needsLink) {
    target.updateMatrixWorld(true);
  }

  // Link new effects
  for (const effectId of effectIds) {
    if (!prevEffectIds.includes(effectId)) {
      registry.link(effectId, target, layerId);
    }
  }
}

/**
 * Registry for managing post effect resources
 * Each effect gets its own Scene and render targets
 */
export class PostEffectRegistry {
  private resources = new Map<string, PostEffectResources>();
  private width: number;
  private height: number;
  private layerPostEffectDepthSettings = new Map<string, boolean>();
  private layerKeepClones = new Map<string, boolean>();

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /**
   * Create resources for a post effect
   */
  create(
    effectId: string,
    options: PostEffectOptions = {},
  ): PostEffectResources {
    if (this.resources.has(effectId)) {
      throw new Error(`Post effect ${effectId} already exists`);
    }

    const resolutionScale = options.resolutionScale ?? 1.0;
    const width = Math.floor(this.width * resolutionScale);
    const height = Math.floor(this.height * resolutionScale);

    // Legacy scene for compatibility (not actively used)
    const scene = new Scene();
    scene.name = `PostEffect_${effectId}`;

    const sceneDepthEnabled = new Scene();
    sceneDepthEnabled.name = `PostEffect_${effectId}_DepthEnabled`;

    const sceneDepthDisabled = new Scene();
    sceneDepthDisabled.name = `PostEffect_${effectId}_DepthDisabled`;

    // Mark scenes so we can detect post effect mask rendering in onBeforeRender
    // and differentiate depth test behavior between them.
    (
      sceneDepthEnabled.userData as {
        postEffectMask?: { enabled: boolean; depthTest: boolean };
      }
    ).postEffectMask = { enabled: true, depthTest: true };
    (
      sceneDepthDisabled.userData as {
        postEffectMask?: { enabled: boolean; depthTest: boolean };
      }
    ).postEffectMask = { enabled: true, depthTest: false };

    const maskRT = new WebGLRenderTarget(width, height, {
      format: RGBAFormat,
      depthBuffer: true,
      stencilBuffer: true,
    });
    maskRT.texture.name = `PostEffectMask_${effectId}`;

    // Legacy render target for compatibility (not actively used)
    const highlightRT = new WebGLRenderTarget(width, height, {
      format: RGBAFormat,
      depthBuffer: true,
      stencilBuffer: true,
    });
    highlightRT.texture.name = `PostEffectHighlight_${effectId}`;

    const objects = new WeakMap<Object3D, Object3D>();
    const objectLayerMap = new Map<string, string>();
    const sourceMap = new Map<string, Object3D>();
    const cloneMap = new Map<string, Object3D>();

    let maskDebug: BufferView | undefined;
    if (options.debugMask) {
      maskDebug = new BufferView(width, height);
    }

    const resources: PostEffectResources = {
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
  get(effectId: string): PostEffectResources | undefined {
    return this.resources.get(effectId);
  }

  /**
   * Register Post Effect Occlusion setting for a layer
   */
  registerLayerPostEffectOcclusion(
    layerId: string,
    postEffectOcclusion: boolean,
  ): void {
    this.layerPostEffectDepthSettings.set(layerId, postEffectOcclusion);
  }

  /**
   * Get Post Effect Occlusion setting for a layer
   */
  getLayerPostEffectOcclusion(layerId: string): boolean {
    return this.layerPostEffectDepthSettings.get(layerId) ?? true;
  }

  /**
   * Update Post Effect Occlusion for all clones of a layer
   * Moves clones between sceneDepthEnabled and sceneDepthDisabled
   * Optimized to only process clones that actually need to move
   */
  updateLayerPostEffectOcclusion(
    layerId: string,
    postEffectOcclusion: boolean,
  ): void {
    // Check if value actually changed (should already be checked in ViewContext, but double-check)
    const currentSetting = this.layerPostEffectDepthSettings.get(layerId);
    if (currentSetting === postEffectOcclusion) {
      return; // No change, skip processing
    }

    // Update the setting
    this.layerPostEffectDepthSettings.set(layerId, postEffectOcclusion);

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
    resources: PostEffectResources,
    clone: Object3D,
    layerId?: string,
  ): void {
    if (!layerId) return;

    const depthTest = this.getLayerPostEffectOcclusion(layerId);

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
      console.warn(`Post effect ${effectId} not found`);
      return;
    }

    // NOTE:
    // マスク用の onBeforeRender / onAfterRender は Mesh / Model 側で付与される前提とする。
    // ここではクローン生成とシーン振り分けのみを行い、クローンは元の Mesh から
    // 付与済みのハンドラ（postEffectMaskBeforeRender/AfterRender）をそのままコピーして使う。

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
      clone.userData.isPostEffectClone = true;
      clone.userData.sourceId = mesh.uuid;

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
   * Unlink an object from a postEffect effect
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
   * Render debug buffer views for all postEffect effects
   */
  renderDebugViews(renderer: WebGLRenderer): void {
    for (const resources of this.resources.values()) {
      if (!resources.maskDebug) continue;
      resources.maskDebug.render(renderer, resources.maskRT);
    }
  }
}
