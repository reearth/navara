import type { EventHandler } from "@navara/core";
import type { Material, PerspectiveCamera } from "three";

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
  private layerEffects = new Map<string, string[]>();

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

  setCamera(camera: PerspectiveCamera) {
    this.camera = camera;
  }

  emit(event: "_csmMounted" | "_csmUnmounted", material: Material): void {
    this.eventHandler?.emit(event, material);
  }

  registerLayerEffects(layerId: string, effects: string[]): void {
    this.layerEffects.set(layerId, effects);
  }

  getLayerEffects(layerId: string): string[] | undefined {
    return this.layerEffects.get(layerId);
  }

  unregisterLayerEffects(layerId: string): void {
    this.layerEffects.delete(layerId);
  }
}
