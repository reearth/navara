import type { Core } from "@navara/engine";

import type { SourceDescription } from "./type";

/**
 * A handle to a data source (GeoJSON, vector tile, raster tile, raster DEM,
 * quantized mesh, 3D Tiles) registered via {@link ThreeView.addSource}.
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
   * Updates the source configuration and re-fetches its data. Every layer that
   * references this source is reset (its resources are torn down) and reloaded
   * against the new configuration.
   *
   * The update is partial, like {@link Layer.update}: any field you omit keeps
   * its current value instead of resetting to a default. `type` cannot change
   * and is always required; `url` is required by the type but, when set to the
   * unchanged value, leaves the fetched URL as-is.
   *
   * @example
   * ```typescript
   * // Only maxZoom changes; tms and the other fields are preserved.
   * imagery.update({
   *   type: "raster-tile",
   *   url: "https://example.com/{z}/{x}/{y}.png",
   *   maxZoom: 22,
   * });
   * ```
   */
  update(s: SourceDescription) {
    this.core.updateSource(this.id, s);
  }

  /**
   * Removes the source and its resources.
   *
   * @returns `false` (and removes nothing) while any layer still references this
   * source; `true` once the source has been removed.
   */
  delete(): boolean {
    return this.core.deleteSource(this.id);
  }
}
