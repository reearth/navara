import type { Core } from "@navara/engine";

import type { SourceDescription } from "./type";

/**
 * A handle to a data source (GeoJSON, vector tile, raster tile, raster DEM,
 * quantized mesh, ellipsoid, 3D Tiles) registered via {@link ThreeView.addSource}.
 *
 * A source describes where data comes from and how it is fetched/decoded. One
 * source can be referenced by multiple layers (by its `id`). The engine
 * reference-counts sources and refuses to delete a source while any layer still
 * references it.
 *
 * @example
 * ```typescript
 * const poi = view.addSource({
 *   type: "vector-tile",
 *   url: "https://example.com/{z}/{x}/{y}.pbf",
 * });
 *
 * view.addLayer({
 *   type: "vector",
 *   source: poi,
 *   sourceLayers: ["building"],
 *   polygon: { color: 0x00aaff },
 * });
 * view.addLayer({
 *   type: "vector",
 *   source: poi,
 *   sourceLayers: ["building"],
 *   polyline: { color: 0xffffff },
 * });
 */
export class Source {
  /** The unique identifier of this source, used to reference it from layers. */
  readonly id: string;
  /** The discriminant type of this source (e.g. "vector-tile"). */
  readonly type: string;
  private core: Core;

  constructor(id: string, type: string, core: Core) {
    this.id = id;
    this.type = type;
    this.core = core;
  }

  /**
   * Updates the source configuration and re-fetches its data. The change
   * propagates to every layer that references this source.
   */
  update(s: SourceDescription) {
    this.core.updateSource(this.id, s);
  }

  /**
   * Removes the source.
   * Note: deletion is ignored while any layer still references this source.
   */
  delete() {
    this.core.deleteSource(this.id);
  }
}
