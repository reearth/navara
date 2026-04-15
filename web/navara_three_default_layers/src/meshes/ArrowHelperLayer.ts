import type ThreeView from "@navara/three";
import {
  type XYZ,
  Color,
  MeshLayerDeclaration,
  type MeshLayerConfig,
  type ViewContext,
} from "@navara/three";
import { ArrowHelper, Vector3 } from "three";

type LayerDescription = {
  arrowHelper?: {
    direction: XYZ;
    origin?: XYZ;
    length?: number;
    color?: Color;
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

  constructor(
    view: ThreeView,
    ctx: ViewContext,
    config: ArrowHelperLayerConfig,
  ) {
    super(view, ctx, config);
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
    const colorValue = cfg.color ?? new Color().setStyle("#ffffff");
    const color = colorValue.raw;
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
        const color = cfg.color.raw;
        this._instance.setColor(color);
      }

      this.emit("needsUpdate");
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
