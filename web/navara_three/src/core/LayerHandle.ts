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

  /**
   * Set selective depth test for this layer
   * @param enabled - Whether to enable depth test for selective effects
   */
  setPostEffectOcclusion(enabled: boolean): void {
    // Check if layer is a MeshLayerDeclaration (has view context)
    if ("view" in this.layer && "id" in this.layer) {
      const layer = this.layer as unknown as {
        view: {
          setLayerPostEffectOcclusion: (id: string, enabled: boolean) => void;
        };
        id: string;
      };
      layer.view.setLayerPostEffectOcclusion(layer.id, enabled);
    }
  }

  /**
   * Set emissive color for this layer
   * @param color - The emissive color as a hex number (e.g., 0xffffff)
   */
  setEmissiveColor(color: number | undefined): void {
    // Check if layer has view context
    if ("view" in this.layer && "id" in this.layer) {
      const layer = this.layer as unknown as {
        view: {
          setLayerEmissiveColor: (
            id: string,
            color: number | undefined,
          ) => void;
        };
        id: string;
      };
      layer.view.setLayerEmissiveColor(layer.id, color);
    }
  }
}
