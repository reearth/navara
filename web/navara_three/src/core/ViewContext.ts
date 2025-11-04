import type { EventHandler, Globe } from "@navara/core";
import {
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  type Material,
  type PerspectiveCamera,
} from "three";

import type { ViewEvents } from "..";
import type { Atmosphere } from "../atmosphere";
import type { LayersManager } from "../layersManager";
import type { RenderPassOrchestrator } from "../orchestrators";
import type { Scenes } from "../scene";
import type { DrapedMaterialCache, MeshCache } from "../type";

import type { SelectiveEffectRegistry } from "./SelectiveEffectRegistry";

export type ViewDebugOptions = {
  selectiveEffectMask?: boolean;
};

type Private = {
  meshes: MeshCache;
  drapedMaterials: DrapedMaterialCache;
};

// Restrict public API for a layer declaration.
export class ViewContext {
  private eventHandler?: EventHandler<ViewEvents>;
  public selectiveRegistry?: SelectiveEffectRegistry;
  public debugOptions: ViewDebugOptions;
  public globe?: Globe;
  private layerEffects = new Map<string, string[]>();
  private layerEmissiveIntensity = new Map<string, number>();

  constructor(
    public scenes: Scenes,
    public camera: PerspectiveCamera,
    public atmosphere: Atmosphere,
    public layersManager: LayersManager,
    public renderPassOrchestrator: RenderPassOrchestrator,
    public _privates: Private,
    eventHandler?: EventHandler<ViewEvents>,
    selectiveRegistry?: SelectiveEffectRegistry,
    debugOptions?: ViewDebugOptions,
  ) {
    this.eventHandler = eventHandler;
    this.selectiveRegistry = selectiveRegistry;
    this.debugOptions = debugOptions ?? {};
  }

  setGlobe(globe: Globe) {
    this.globe = globe;
  }

  setCamera(camera: PerspectiveCamera) {
    this.camera = camera;
  }

  emit(event: "_csmMounted" | "_csmUnmounted", material: Material): void {
    this.eventHandler?.emit(event, material);
  }

  registerLayerEffects(
    layerId: string,
    effects: string[],
    ignoreDepth?: boolean,
    emissiveIntensity?: number,
    options?: { keepClones?: boolean },
  ): void {
    this.layerEffects.set(layerId, effects);

    // Register emissive intensity if provided
    if (emissiveIntensity !== undefined) {
      this.layerEmissiveIntensity.set(layerId, emissiveIntensity);
    }

    // Register depth setting if provided
    if (ignoreDepth !== undefined && this.selectiveRegistry) {
      this.selectiveRegistry.registerLayerDepth(layerId, ignoreDepth);
    }

    if (this.selectiveRegistry) {
      this.selectiveRegistry.registerLayerKeepClones(
        layerId,
        options?.keepClones,
      );
    }
  }

  getLayerEffects(layerId: string): string[] | undefined {
    return this.layerEffects.get(layerId);
  }

  getLayerEmissiveIntensity(layerId: string): number {
    return this.layerEmissiveIntensity.get(layerId) ?? 0.3;
  }

  unregisterLayerEffects(layerId: string): void {
    this.layerEffects.delete(layerId);
    this.layerEmissiveIntensity.delete(layerId);
    this.selectiveRegistry?.registerLayerKeepClones(layerId, false);
  }

  updateLayerEffects(
    layerId: string,
    effects: string[] | undefined,
    emissiveIntensity?: number,
    options?: { keepClones?: boolean },
  ): void {
    const layer = this.layersManager.get(layerId);
    if (!layer) return;

    // Get previous effects
    const prevEffects = this.layerEffects.get(layerId) ?? [];
    const newEffects = effects ?? [];

    this.updateLayerEffectCaches(
      layerId,
      newEffects,
      emissiveIntensity,
      options,
    );

    // Try to access featureEvaluators (for GeoJSON/Cesium3DTiles layers)
    const featureEvaluators = (layer as any).featureEvaluators;
    if (!featureEvaluators || !this.selectiveRegistry) return;

    // Update effects for each feature's mesh
    for (const evaluator of featureEvaluators.values()) {
      const obj = evaluator.obj;
      if (!obj) continue;

      this.updateSelectiveLinks(obj, layerId, prevEffects, newEffects);
      this.applyEmissive(obj, layerId, newEffects, emissiveIntensity);
    }
  }

  private updateLayerEffectCaches(
    layerId: string,
    newEffects: string[],
    emissiveIntensity: number | undefined,
    options?: { keepClones?: boolean },
  ): void {
    if (newEffects.length > 0) {
      this.layerEffects.set(layerId, newEffects);
    } else {
      this.layerEffects.delete(layerId);
    }

    if (emissiveIntensity !== undefined) {
      this.layerEmissiveIntensity.set(layerId, emissiveIntensity);
    } else if (!this.layerEmissiveIntensity.has(layerId)) {
      this.layerEmissiveIntensity.set(
        layerId,
        this.getLayerEmissiveIntensity(layerId),
      );
    }

    if (options?.keepClones !== undefined && this.selectiveRegistry) {
      this.selectiveRegistry.registerLayerKeepClones(
        layerId,
        options.keepClones,
      );
    }
  }

  private updateSelectiveLinks(
    obj: Object3D,
    layerId: string,
    prevEffects: string[],
    newEffects: string[],
  ): void {
    if (!this.selectiveRegistry) return;

    for (const effectId of prevEffects) {
      if (!newEffects.includes(effectId)) {
        this.selectiveRegistry.unlink(effectId, obj);
      }
    }

    const needsLink = newEffects.some(
      (effectId) => !prevEffects.includes(effectId),
    );
    if (needsLink) {
      obj.updateMatrixWorld(true);
    }

    for (const effectId of newEffects) {
      if (!prevEffects.includes(effectId)) {
        this.selectiveRegistry.link(effectId, obj, layerId);
      }
    }
  }

  private applyEmissive(
    obj: Object3D,
    layerId: string,
    newEffects: string[],
    emissiveIntensity: number | undefined,
  ): void {
    const intensity =
      emissiveIntensity ?? this.layerEmissiveIntensity.get(layerId) ?? 0.3;

    this.forEachMesh(obj, (mesh) => {
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];

      for (const material of materials) {
        if (
          material instanceof MeshStandardMaterial ||
          material instanceof MeshPhysicalMaterial
        ) {
          if (newEffects.length > 0) {
            material.emissive.copy(material.color);
            material.emissiveIntensity = intensity;
          } else {
            material.emissiveIntensity = 0;
          }
        }
      }
    });
  }

  private forEachMesh(obj: Object3D, fn: (mesh: Mesh) => void): void {
    if (obj instanceof Mesh) {
      fn(obj);
      return;
    }

    obj.traverse((child) => {
      if (child instanceof Mesh) {
        fn(child);
      }
    });
  }
}
