import { EventHandler } from "@navara/core/src/eventHandler";
import type { Core } from "navara_wasm";

import type { FeatureEvaluator } from "./evaluations/FeatureEvaluator";
import type { LayerDescription } from "./type";

export type LayerEvent = {
  featureCreated: (evaluator: FeatureEvaluator) => void;
  featureUpdated: (evaluator: FeatureEvaluator, updatedAt: number) => void;
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
