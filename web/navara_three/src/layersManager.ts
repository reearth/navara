import type { Layer, LayerEvent } from "./layer";

export class LayersManager {
  _layers = new Map<string, Layer>();

  add(l: Layer) {
    this._layers.set(l.id, l);
    const deleteLayer = () => {
      this._layers.delete(l.id);
    };
    l.on("deleted", deleteLayer);
  }

  get(id: string) {
    return this._layers.get(id);
  }

  emitById<K extends keyof LayerEvent>(
    k: K,
    id: string,
    ...args: Parameters<LayerEvent[K]>
  ) {
    const l = this._layers.get(id);
    if (!l) return;
    l.emit(k, ...args);
  }

  emitAll<K extends keyof LayerEvent>(
    k: K,
    ...args: Parameters<LayerEvent[K]>
  ) {
    for (const l of this._layers.values()) {
      l.emit(k, ...args);
    }
  }
}
