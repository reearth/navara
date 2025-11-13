import type { EventHandler, Globe } from "@navara/core";
import { Object3D, type Material, type PerspectiveCamera } from "three";

import type { ViewEvents } from "..";
import type { Atmosphere } from "../atmosphere";
import { Layer } from "../layer";
import type { LayersManager } from "../layersManager";
import type { CustomObject3DEvent } from "../object3DEvent";
import type { RenderPassOrchestrator } from "../orchestrators";
import type { Scenes } from "../scene";
import type { DrapedMaterialCache, MeshCache } from "../type";

import { LayerHandle } from "./LayerHandle";
import { MeshLayerDeclaration } from "./MeshLayerDeclaration";
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
      layersManager,
      selectiveRegistry: this.selectiveRegistry,
      dispatchEvent: this.dispatchCustomEvent.bind(this),
      getLayerHandleObject: this.getLayerHandleObject.bind(this),
      requestRender: this.requestRender.bind(this),
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
    effects: string[],
    selectiveDepthTest?: boolean,
    emissiveIntensity?: number,
    options?: { keepClones?: boolean },
  ): void {
    this.postEffects.registerLayerEffects(
      layerId,
      effects,
      selectiveDepthTest,
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

  getLayerSelectiveDepthTest(layerId: string): boolean {
    return this.postEffects.getLayerSelectiveDepthTest(layerId);
  }

  setLayerSelectiveDepthTest(
    layerId: string,
    selectiveDepthTest: boolean,
  ): void {
    this.postEffects.setLayerSelectiveDepthTest(layerId, selectiveDepthTest);
  }

  unregisterLayerEffects(layerId: string): void {
    this.postEffects.unregisterLayerEffects(layerId);
  }

  updateLayerEffects(
    layerId: string,
    effects: string[] | undefined,
    emissiveIntensity?: number,
    options?: { keepClones?: boolean },
  ): void {
    this.postEffects.updateLayerEffects(
      layerId,
      effects,
      emissiveIntensity,
      options,
    );
  }

  private dispatchCustomEvent(obj: Object3D, event: CustomObject3DEvent): void {
    // Ensure target is set correctly
    const eventWithTarget = { ...event, target: obj };

    // Three.js event system requires casting through unknown for custom events
    // The event structure is validated by TypeScript at creation time and by type guards at consumption time
    const dispatchMethod = obj.dispatchEvent.bind(obj);
    dispatchMethod(
      eventWithTarget as unknown as Parameters<typeof dispatchMethod>[0],
    );
  }

  private getLayerHandleObject(layerHandle: LayerHandle): Object3D | undefined {
    const declaration = layerHandle.ref;
    if (declaration instanceof MeshLayerDeclaration) {
      return declaration.raw ?? undefined;
    }

    return undefined;
  }

  private requestRender(layer: Layer | LayerHandle | undefined): void {
    if (!layer) return;

    if (layer instanceof Layer) {
      layer.forceUpdate();
      return;
    }

    // For MeshLayerDeclaration (wrapped by LayerHandle), emit _needsUpdate so ThreeView.forceUpdate() runs
    layer.ref.emit("_needsUpdate");
  }
}
