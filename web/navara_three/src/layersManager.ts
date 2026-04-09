import { EffectDeclaration, Handle } from "./core";
import { Layer, type LayerEvent } from "./layer";

export class LayersManager {
  private layers = new Map<string, Layer | Handle>();

  add(l: Layer | Handle) {
    this.layers.set(l.id, l);
    const deleteLayer = () => {
      this.layers.delete(l.id);
    };
    if (l instanceof Handle) {
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

  *getEffectLayers(): Generator<Handle<EffectDeclaration>> {
    for (const handle of this.layers.values()) {
      if (!(handle instanceof Handle)) continue;

      const layer = handle.ref;
      if (!(layer instanceof EffectDeclaration)) continue;

      yield handle as Handle<EffectDeclaration>;
    }
  }

  *getDeclarationLayers(): Generator<Handle> {
    for (const handle of this.layers.values()) {
      if (!(handle instanceof Handle)) continue;
      yield handle;
    }
  }
}
