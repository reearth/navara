import { EventHandler } from "@navara/core";

import type { LayerDescription } from "../type";

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

  /* eslint-disable @typescript-eslint/unified-signatures */
  // Overload: Accept LayerDescription directly (for React/generic usage)
  update(updates: LayerDescription): void;
  // Overload: Type-safe signature for specific layer types
  update(
    updates: T extends LayerDeclaration<infer _A, infer B>
      ? B
      : LayerDeclarationConfigUpdate,
  ): void;
  /* eslint-enable @typescript-eslint/unified-signatures */
  // Implementation
  update(
    updates:
      | LayerDescription
      | (T extends LayerDeclaration<infer _A, infer B>
          ? B
          : LayerDeclarationConfigUpdate),
  ): void {
    this.layer.onUpdateConfig(updates as LayerDeclarationConfigUpdate);
  }

  get ref(): T {
    return this.layer;
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
}
