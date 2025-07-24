import { EventHandler } from "@navara/core";

import {
  LayerDeclaration,
  type LayerDeclarationConfigUpdate,
} from "./LayerDeclaration";

export type LayerHandleEvent = {
  deleted: () => void;
};

export class LayerHandle<
  T extends LayerDeclaration = LayerDeclaration,
> extends EventHandler<LayerHandleEvent> {
  constructor(private layer: T) {
    super();
  }

  update(
    updates: T extends LayerDeclaration<infer _A, infer B>
      ? B
      : LayerDeclarationConfigUpdate,
  ): void {
    this.layer.onUpdateConfig(updates);
  }

  get ref(): T["instance"] {
    return this.layer.instance;
  }

  delete(): void {
    this.layer.onDestroy();
  }

  get id(): string {
    return this.layer.id;
  }

  get visible(): boolean {
    return this.layer.visible;
  }

  set visible(visible: boolean) {
    this.layer.visible = visible;
  }

  get sort(): number | undefined {
    return this.layer.sort;
  }

  getLayer(): T {
    return this.layer;
  }
}
