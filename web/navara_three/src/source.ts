import type { Core } from "@navara/engine";

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
 *   sourceLayers: ["building"],
 * });
 *
 * view.addLayer({ type: "vector", source: poi, polygon: { color: 0x00aaff } });
 * view.addLayer({ type: "vector", source: poi, polyline: { color: 0xffffff } });
 * ```
 */
export class Source {
  /** The unique identifier of this source, used to reference it from layers. */
  id: string;
  /** The discriminant type of this source (e.g. "vector-tile"). */
  type: string;
  // private core: Core;

  constructor(id: string, type: string, _core: Core) {
    this.id = id;
    this.type = type;
    // this.core = core;
  }

  /**
   * Updates the source configuration and re-fetches its data. The change
   * propagates to every layer that references this source.
   */
  // TODO: Support dynamic update
  // update(s: SourceDescription) {
  //   this.core.updateSource(this.id, s);
  // }

  /**
   * Removes the source. This is refused (with a warning) while any layer still
   * references it; delete the referencing layers first.
   */
  // TODO: Support dynamic deletion
  // delete() {
  //   this.core.deleteSource(this.id);
  // }
}
