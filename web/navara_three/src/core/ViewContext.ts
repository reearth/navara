import type { EventHandler, Globe } from "@navara/core";
import type { Material, Object3D, PerspectiveCamera } from "three";

import type { ViewEvents } from "..";
import type { Atmosphere } from "../atmosphere";
import type { LayersManager } from "../layersManager";
import type { RenderPassOrchestrator } from "../orchestrators";
import type { Scenes } from "../scene";
import type { DrapedMaterialCache, MeshCache } from "../type";

import {
  getPostEffectConfig,
  type PostEffectHelper,
  type PostEffectOcclusionValue,
} from "./PostEffectHelper";
import { PostEffectManager } from "./PostEffectManager";

export type ViewDebugOptions = {
  postEffectMask?: boolean;
};

type Private = {
  meshes: MeshCache;
  drapedMaterials: DrapedMaterialCache;
};

// Restrict public API for a layer declaration.
export class ViewContext {
  private eventHandler?: EventHandler<ViewEvents>;
  public postEffectRegistry?: PostEffectHelper;
  public debugOptions: ViewDebugOptions;
  public globe?: Globe;

  private readonly postEffects: PostEffectManager;

  constructor(
    public scenes: Scenes,
    public camera: PerspectiveCamera,
    public atmosphere: Atmosphere,
    public layersManager: LayersManager,
    public renderPassOrchestrator: RenderPassOrchestrator,
    public _privates: Private,
    eventHandler?: EventHandler<ViewEvents>,
    postEffectHelper?: PostEffectHelper,
    debugOptions?: ViewDebugOptions,
  ) {
    this.eventHandler = eventHandler;
    this.postEffectRegistry = postEffectHelper;
    this.debugOptions = debugOptions ?? {};

    this.postEffects = new PostEffectManager({
      postEffectRegistry: this.postEffectRegistry,
    });
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
    effectIds: string[],
    postEffectOcclusion?: PostEffectOcclusionValue,
    emissiveIntensity?: number,
  ): void {
    this.postEffects.registerLayerEffects(
      layerId,
      effectIds,
      postEffectOcclusion,
      emissiveIntensity,
    );
  }

  getLayerEffects(layerId: string): string[] | undefined {
    return this.postEffects.getLayerEffects(layerId);
  }

  setLayerEmissiveColor(
    layerId: string,
    emissiveColor: number | undefined,
  ): void {
    this.postEffects.setLayerEmissiveColor(layerId, emissiveColor);
  }

  setLayerPostEffectOcclusion(
    layerId: string,
    postEffectOcclusion: PostEffectOcclusionValue,
  ): void {
    // Delegate to Manager (the single SoT for occlusion)
    this.postEffects.setLayerOcclusion(layerId, postEffectOcclusion);
  }

  unregisterLayerEffects(layerId: string): void {
    this.postEffects.unregisterLayerEffects(layerId);
  }

  updateLayerEffects(
    layerId: string,
    effectIds: string[] | undefined,
    emissiveIntensity?: number,
  ): void {
    this.postEffects.updateLayerEffects(layerId, effectIds, emissiveIntensity);
  }

  /**
   * Apply post effects to a specific Object3D.
   * Useful for pick-based effect application where you have a reference to the object.
   *
   * @param object - The Object3D to apply effects to
   * @param effectIds - Effect IDs to apply (e.g., ["bloom"], ["outline"], ["bloom", "outline"])
   * @param layerId - Optional layer ID for occlusion resolution.
   *                  Resolution order: argument > existing config > Normal occlusion
   */
  applyEffectToObject(
    object: Object3D,
    effectIds: string[],
    layerId?: string,
  ): void {
    // Resolve layerId: argument > existing config > undefined (Normal occlusion)
    const resolvedLayerId = layerId ?? getPostEffectConfig(object)?.layerId;

    const prevEffectIds = getPostEffectConfig(object)?.effectIds ?? [];
    this.postEffectRegistry?.updateLinksForObject(
      object,
      effectIds,
      prevEffectIds,
      resolvedLayerId ?? "",
    );
  }

  /**
   * Remove post effects from a specific Object3D.
   *
   * @param object - The Object3D to remove effects from
   * @param effectIds - Effect IDs to remove. If undefined, removes all effects.
   */
  removeEffectFromObject(object: Object3D, effectIds?: string[]): void {
    const config = getPostEffectConfig(object);
    if (!config) return;

    const prevEffectIds = config.effectIds;
    const nextEffectIds = effectIds
      ? prevEffectIds.filter((id) => !effectIds.includes(id))
      : [];

    this.postEffectRegistry?.updateLinksForObject(
      object,
      nextEffectIds,
      prevEffectIds,
      config.layerId ?? "",
    );
  }
}
