import type { EventHandler, Globe } from "@navara/core";
import type { Material, PerspectiveCamera } from "three";

import type { ViewEvents } from "..";
import type { Atmosphere } from "../atmosphere";
import type { LayersManager } from "../layersManager";
import type { RenderPassOrchestrator } from "../orchestrators";
import type { Scenes } from "../scene";
import type { DrapedMaterialCache, MeshCache } from "../type";

import { PostEffectManager } from "./PostEffectManager";
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

  private readonly postEffects: PostEffectManager;

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

    this.postEffects = new PostEffectManager({
      selectiveRegistry: this.selectiveRegistry,
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
    postEffectOcclusion?: boolean,
    emissiveIntensity?: number,
    options?: { keepClones?: boolean },
  ): void {
    this.postEffects.registerLayerEffects(
      layerId,
      effectIds,
      postEffectOcclusion,
      emissiveIntensity,
      options,
    );
  }

  getLayerEffects(layerId: string): string[] | undefined {
    return this.postEffects.getLayerEffects(layerId);
  }

  getLayerEmissiveIntensity(layerId: string): number {
    return this.postEffects.getLayerEmissiveIntensity(layerId);
  }

  getLayerEmissiveColor(layerId: string): number | undefined {
    return this.postEffects.getLayerEmissiveColor(layerId);
  }

  setLayerEmissiveColor(
    layerId: string,
    emissiveColor: number | undefined,
  ): void {
    this.postEffects.setLayerEmissiveColor(layerId, emissiveColor);
  }

  getLayerPostEffectOcclusion(layerId: string): boolean {
    return this.postEffects.getLayerPostEffectOcclusion(layerId);
  }

  setLayerPostEffectOcclusion(
    layerId: string,
    postEffectOcclusion: boolean,
  ): void {
    this.postEffects.setLayerPostEffectOcclusion(layerId, postEffectOcclusion);
  }

  unregisterLayerEffects(layerId: string): void {
    this.postEffects.unregisterLayerEffects(layerId);
  }

  updateLayerEffects(
    layerId: string,
    effectIds: string[] | undefined,
    emissiveIntensity?: number,
    options?: { keepClones?: boolean },
  ): void {
    this.postEffects.updateLayerEffects(
      layerId,
      effectIds,
      emissiveIntensity,
      options,
    );
  }
}
