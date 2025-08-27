import type { XYZ } from "@navara/core";
import { ArrowHelper, Vector3 } from "three";

import {
  MeshLayerDeclaration,
  type MeshLayerConfig,
  type ViewContext,
} from "../../core";

type LayerDescription = {
  arrowHelper?: {
    direction: XYZ;
    origin?: XYZ;
    length?: number;
    color?: number;
    headLength?: number;
    headWidth?: number;
  };
};

export type ArrowHelperLayerConfig = MeshLayerConfig & LayerDescription;

export type ArrowHelperLayerUpdate = Pick<
  MeshLayerConfig,
  "position" | "visible"
> &
  LayerDescription;

export class ArrowHelperLayer extends MeshLayerDeclaration<
  ArrowHelperLayerConfig,
  ArrowHelperLayerUpdate,
  ArrowHelper
> {
  private config: ArrowHelperLayerConfig;

  constructor(view: ViewContext, config: ArrowHelperLayerConfig) {
    super(view, config);
    this.config = config;
  }

  createMesh(): ArrowHelper {
    const cfg = this.config.arrowHelper;
    if (!cfg?.direction) {
      throw new Error("ArrowHelper requires a direction");
    }

    const direction = new Vector3(
      cfg.direction.x,
      cfg.direction.y,
      cfg.direction.z,
    ).normalize();
    const origin = cfg.origin
      ? new Vector3(cfg.origin.x, cfg.origin.y, cfg.origin.z)
      : new Vector3(0, 0, 0);
    const length = cfg.length ?? 1;
    const color = cfg.color ?? 0xffff00;
    const headLength = cfg.headLength;
    const headWidth = cfg.headWidth;

    return new ArrowHelper(
      direction,
      origin,
      length,
      color,
      headLength,
      headWidth,
    );
  }

  onUpdateConfig(updates: ArrowHelperLayerUpdate): void {
    if (updates.arrowHelper && this._instance) {
      const cfg = updates.arrowHelper;

      if (cfg.direction) {
        this._instance.setDirection(
          new Vector3(cfg.direction.x, cfg.direction.y, cfg.direction.z),
        );
      }

      if (cfg.length !== undefined) {
        this._instance.setLength(cfg.length, cfg.headLength, cfg.headWidth);
      }

      if (cfg.color !== undefined) {
        this._instance.setColor(cfg.color);
      }

      this.emit("_needsUpdate");
    }

    super.onUpdateConfig(updates);
  }

  protected disposeMesh(): void {
    if (this._instance) {
      this._instance.dispose();
      this._instance = undefined;
    }
  }
}
