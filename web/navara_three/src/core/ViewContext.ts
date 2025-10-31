import type { EventHandler, Globe } from "@navara/core";
import type { Material, PerspectiveCamera } from "three";

import type { ViewEvents } from "..";
import type { Atmosphere } from "../atmosphere";
import type { LayersManager } from "../layersManager";
import type { RenderPassOrchestrator } from "../orchestrators";
import type { Scenes } from "../scene";
import type { DrapedMaterialCache, MeshCache } from "../type";

type Private = {
  meshes: MeshCache;
  drapedMaterials: DrapedMaterialCache;
};

// Restrict public API for a layer declaration.
export class ViewContext {
  private eventHandler?: EventHandler<ViewEvents>;
  public globe?: Globe;

  constructor(
    public scenes: Scenes,
    public camera: PerspectiveCamera,
    public atmosphere: Atmosphere,
    public layersManager: LayersManager,
    public renderPassOrchestrator: RenderPassOrchestrator,
    public _privates: Private,
    eventHandler?: EventHandler<ViewEvents>,
  ) {
    this.eventHandler = eventHandler;
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
}
