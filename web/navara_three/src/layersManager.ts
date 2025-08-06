import { EffectLayerDeclaration, LayerHandle } from "./core";
import { Layer, type LayerEvent } from "./layer";

export class LayersManager {
  private layers = new Map<string, Layer | LayerHandle>();

  add(l: Layer | LayerHandle) {
    this.layers.set(l.id, l);
    const deleteLayer = () => {
      this.layers.delete(l.id);
    };
    if (l instanceof LayerHandle) {
      l.on("deleted", deleteLayer);
    } else {
      l.on("deleted", deleteLayer);
    }
  }

  get(id: string) {
    return this.layers.get(id);
  }

  emitById<K extends keyof LayerEvent>(
    k: K,
    id: string,
    ...args: Parameters<LayerEvent[K]>
  ) {
    const l = this.layers.get(id);
    if (!l) return;
    if (l instanceof Layer) {
      l.emit(k, ...args);
    }
  }

  emitAll<K extends keyof LayerEvent>(
    k: K,
    ...args: Parameters<LayerEvent[K]>
  ) {
    for (const l of this.layers.values()) {
      if (l instanceof Layer) {
        l.emit(k, ...args);
      }
    }
  }

  *getResourceLayers() {
    for (const l of this.layers.values()) {
      if (!(l instanceof Layer)) continue;
      yield l;
    }
  }

  *getEffectLayers(): Generator<LayerHandle<EffectLayerDeclaration>> {
    for (const handle of this.layers.values()) {
      if (!(handle instanceof LayerHandle)) continue;

      const layer = handle.getLayer();
      if (!(layer instanceof EffectLayerDeclaration)) continue;

      yield handle as LayerHandle<EffectLayerDeclaration>;
    }
  }

  *getDeclarationLayers(): Generator<LayerHandle> {
    for (const handle of this.layers.values()) {
      if (!(handle instanceof LayerHandle)) continue;
      yield handle;
    }
  }
}
