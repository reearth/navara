import type { Layer, LayerEvent } from "./layer";

export class LayersManager {
  private layers = new Map<string, Layer>();

  add(l: Layer) {
    this.layers.set(l.id, l);
    const deleteLayer = () => {
      this.layers.delete(l.id);
    };
    l.on("deleted", deleteLayer);
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
    l.emit(k, ...args);
  }

  emitAll<K extends keyof LayerEvent>(
    k: K,
    ...args: Parameters<LayerEvent[K]>
  ) {
    for (const l of this.layers.values()) {
      l.emit(k, ...args);
    }
  }
}
