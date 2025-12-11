import type { Globe as GlobeWasm } from "@navara/engine";

import { ColorMap, Color } from "../color";
/**
 * Handler for accessing individual Globe properties from WASM.
 * This provides a reference-based interface instead of copying the entire Globe object.
 */
export type GlobeHandler = {
  getTransparent: () => boolean | undefined;
  getMaxSse: () => number | undefined;
  getSegments: () => number | undefined;
  getColor: () => Color | undefined;
  getHideUnderground: () => boolean | undefined;
  getShouldComputeNormalFromVertex: () => boolean | undefined;
  getOpacity: () => number | undefined;
  getWireframe: () => boolean | undefined;
  getElevationColormap: () => Float32Array | undefined;
  setTransparent: (value: boolean) => void;
  setMaxSse: (value: number) => void;
  setSegments: (value: number) => void;
  setColor: (value: Color) => void;
  setHideUnderground: (value: boolean) => void;
  setShouldComputeNormalFromVertex: (value: boolean) => void;
  setOpacity: (value: number) => void;
  setWireframe: (value: boolean) => void;
  setElevationColormap: (value: ColorMap) => void;
};

export type GlobeOptions = Partial<
  Omit<GlobeWasm, "constructor" | "free" | "elevationColormap" | "color">
> & {
  elevationColormap?: ColorMap;
  color?: Color;
};

/**
 * Globe configuration manager.
 *
 * Provides an interface for accessing and modifying globe properties
 * that are shared across different material types (VectorTile, RasterTile, RasterTerrain).
 */
export class Globe
  implements Omit<GlobeWasm, "free" | "elevationColormap" | "color">
{
  private handler: GlobeHandler;
  private _elevationColormap?: ColorMap;

  constructor(handler: GlobeHandler, options?: GlobeOptions) {
    this.handler = handler;
    this.setOptions(options);
  }

  setOptions(options?: GlobeOptions) {
    if (options?.maxSse != null) {
      this.maxSse = options.maxSse;
    }
    if (options?.segments != null) {
      this.segments = options.segments;
    }
    if (options?.color != null) {
      this.color = options.color;
    }
    if (options?.hideUnderground != null) {
      this.hideUnderground = options.hideUnderground;
    }
    if (options?.shouldComputeNormalFromVertex != null) {
      this.shouldComputeNormalFromVertex =
        options.shouldComputeNormalFromVertex;
    }
    if (options?.transparent != null) {
      this.transparent = options.transparent;
    }
    if (options?.opacity != null) {
      this.opacity = options.opacity;
    }
    if (options?.wireframe != null) {
      this.wireframe = options.wireframe;
    }
    if (options?.elevationColormap != null) {
      this.elevationColormap = options.elevationColormap;
    }
  }

  get maxSse(): number {
    return this.handler.getMaxSse() ?? 2.0;
  }

  set maxSse(value: number) {
    this.handler.setMaxSse(value);
  }

  get segments(): number {
    return this.handler.getSegments() ?? 64;
  }
  set segments(value: number) {
    this.handler.setSegments(value);
  }

  get color(): Color | undefined {
    return this.handler.getColor();
  }

  set color(value: Color) {
    this.handler.setColor(value);
  }

  get hideUnderground(): boolean {
    return this.handler.getHideUnderground() ?? true;
  }

  set hideUnderground(value: boolean) {
    this.handler.setHideUnderground(value);
  }

  get shouldComputeNormalFromVertex(): boolean {
    return this.handler.getShouldComputeNormalFromVertex() ?? true;
  }

  set shouldComputeNormalFromVertex(value: boolean) {
    this.handler.setShouldComputeNormalFromVertex(value);
  }

  get transparent(): boolean {
    return this.handler.getTransparent() ?? false;
  }

  set transparent(value: boolean) {
    this.handler.setTransparent(value);
  }

  get opacity(): number {
    return this.handler.getOpacity() ?? 1.0;
  }

  set opacity(value: number) {
    this.handler.setOpacity(value);
  }

  get wireframe(): boolean {
    return this.handler.getWireframe() ?? false;
  }

  set wireframe(value: boolean) {
    this.handler.setWireframe(value);
  }

  get elevationColormap(): ColorMap | undefined {
    return this._elevationColormap;
  }

  set elevationColormap(value: ColorMap) {
    this._elevationColormap = value;
    this.handler.setElevationColormap(value);
  }
}
