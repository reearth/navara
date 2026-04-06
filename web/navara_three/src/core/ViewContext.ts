import type { Globe } from "@navara/core";
import { EventHandler } from "@navara/core";
import type { FontManager } from "@navara/font";
import type { ConcurrencyManager } from "@navara/worker";
import type { Material, Object3D, PerspectiveCamera } from "three";

import type { Atmosphere } from "../atmosphere";
import { Color } from "../Color";
import type { LayersManager } from "../layersManager";
import type { RenderPassOrchestrator } from "../orchestrators";
import type { Scenes } from "../scene";
import type { MeshCache } from "../type";

import {
  getSelectiveEffectConfig,
  type SelectiveEffectHelper,
  type SelectiveEffectOcclusionValue,
} from "./SelectiveEffectHelper";
import { SelectiveEffectManager } from "./SelectiveEffectManager";

export type ViewDebugOptions = {
  selectiveEffectMask?: boolean;
};

type Private = {
  meshes: MeshCache;
};

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
};

// Restrict public API for a layer declaration.
export class ViewContext extends EventHandler<ViewContextEvents> {
  public selectiveEffectRegistry?: SelectiveEffectHelper;
  public debugOptions: ViewDebugOptions;
  public globe?: Globe;
  public fontManager?: FontManager;

  private readonly selectiveEffects: SelectiveEffectManager;

  constructor(
    public scenes: Scenes,
    public camera: PerspectiveCamera,
    public atmosphere: Atmosphere,
    public layersManager: LayersManager,
    public renderPassOrchestrator: RenderPassOrchestrator,
    public concurrencyManager: ConcurrencyManager,
    public _privates: Private,
    selectiveEffectHelper?: SelectiveEffectHelper,
    debugOptions?: ViewDebugOptions,
  ) {
    super();
    this.selectiveEffectRegistry = selectiveEffectHelper;
    this.debugOptions = debugOptions ?? {};

    this.selectiveEffects = new SelectiveEffectManager({
      selectiveEffectRegistry: this.selectiveEffectRegistry,
    });
  }

  setGlobe(globe: Globe) {
    this.globe = globe;
  }

  setCamera(camera: PerspectiveCamera) {
    this.camera = camera;
  }

  applyShadowMaterial(material: Material): void {
    this.emit("shadowApplied", material);
  }

  removeShadowMaterial(material: Material): void {
    this.emit("shadowRemoved", material);
  }

  registerLayerEffects(
    layerId: string,
    effectIds: string[],
    selectiveEffectOcclusion?: SelectiveEffectOcclusionValue,
    emissiveIntensity?: number,
  ): void {
    this.selectiveEffects.registerLayerEffects(
      layerId,
      effectIds,
      selectiveEffectOcclusion,
      emissiveIntensity,
    );
  }

  getLayerEffects(layerId: string): string[] | undefined {
    return this.selectiveEffects.getLayerEffects(layerId);
  }

  setLayerEmissiveColor(
    layerId: string,
    emissiveColor: Color | undefined,
  ): void {
    this.selectiveEffects.setLayerEmissiveColor(layerId, emissiveColor);
  }

  setLayerSelectiveEffectOcclusion(
    layerId: string,
    selectiveEffectOcclusion: SelectiveEffectOcclusionValue,
  ): void {
    // Delegate to Manager (the single SoT for occlusion)
    this.selectiveEffects.setLayerOcclusion(layerId, selectiveEffectOcclusion);
  }

  clearLayerSelectiveEffectOcclusion(layerId: string): void {
    this.selectiveEffects.clearLayerOcclusion(layerId);
  }

  unregisterLayerEffects(layerId: string): void {
    this.selectiveEffects.unregisterLayerEffects(layerId);
  }

  updateLayerEffects(
    layerId: string,
    effectIds: string[] | undefined,
    emissiveIntensity?: number,
  ): void {
    this.selectiveEffects.updateLayerEffects(
      layerId,
      effectIds,
      emissiveIntensity,
    );
  }

  /**
   * Apply selective effects to a specific Object3D.
   * Useful for pick-based effect application where you have a reference to the object.
   *
   * @param object - The Object3D to apply effects to
   * @param effectIds - Effect IDs to apply (e.g., ["selectiveBloom"], ["selectiveOutline"], ["selectiveBloom", "selectiveOutline"])
   * @param layerId - Optional layer ID for occlusion resolution.
   *                  Resolution order: argument > existing config > Normal occlusion
   */
  applyEffectToObject(
    object: Object3D,
    effectIds: string[],
    layerId?: string,
  ): void {
    // Resolve layerId: argument > existing config > undefined (Normal occlusion)
    const resolvedLayerId =
      layerId ?? getSelectiveEffectConfig(object)?.layerId;

    const prevEffectIds = getSelectiveEffectConfig(object)?.effectIds ?? [];
    this.selectiveEffectRegistry?.updateLinksForObject(
      object,
      effectIds,
      prevEffectIds,
      resolvedLayerId ?? "",
    );
  }

  /**
   * Remove selective effects from a specific Object3D.
   *
   * @param object - The Object3D to remove effects from
   * @param effectIds - Effect IDs to remove. If undefined, removes all effects.
   */
  removeEffectFromObject(object: Object3D, effectIds?: string[]): void {
    const config = getSelectiveEffectConfig(object);
    if (!config) return;

    const prevEffectIds = config.effectIds;
    const nextEffectIds = effectIds
      ? prevEffectIds.filter((id) => !effectIds.includes(id))
      : [];

    this.selectiveEffectRegistry?.updateLinksForObject(
      object,
      nextEffectIds,
      prevEffectIds,
      config.layerId ?? "",
    );
  }
}
