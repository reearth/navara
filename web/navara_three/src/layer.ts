import { EventHandler } from "@navara/core/src/eventHandler";
import type { Core } from "navara_wasm";
import type { Object3D } from "three";

import type { LayerDescription } from "./type";

export type LayerEvent = {
  featureCreated: (m: Object3D) => void;
  featureUpdated: (m: Object3D, updatedAt: number) => void;
  deleted: () => void;
};

export class Layer extends EventHandler<LayerEvent> {
  id: string;
  private core: Core;

  constructor(id: string, core: Core) {
    super();

    this.id = id;
    this.core = core;
  }

  update(l: LayerDescription) {
    this.core.updateLayer(this.id, l);
  }

  delete() {
    this.core.deleteLayer(this.id);
    this.emit("deleted");
  }
}
