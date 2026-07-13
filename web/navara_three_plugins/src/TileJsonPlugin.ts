/**
 * TileJsonPlugin — Navara Plugin for TileJSON 3.0.0 tile sources.
 *
 * Fetches a
 * {@link https://github.com/mapbox/tilejson-spec/tree/master/3.0.0 | TileJSON 3.0.0}
 * document and registers it as a single Navara source. {@link TileJsonPlugin.addSource}
 * mirrors {@link ThreeView.addSource}: a discriminated `type` plus an optional
 * `id`, with `url` pointing at the TileJSON document. The plugin derives the tile
 * URL, `minzoom`/`maxzoom`, and `scheme` from the document, and surfaces its
 * `attribution` automatically through an {@link AttributionPlugin}.
 *
 * ## Usage
 *
 * ```ts
 * import ThreeView from "@navara/three";
 * import { AttributionPlugin, TileJsonPlugin } from "@navara/three_plugins";
 *
 * const view = new ThreeView({ container });
 * const attribution = new AttributionPlugin();
 * const tilejson = new TileJsonPlugin({ attribution });
 * view.addPlugin(attribution);
 * view.addPlugin(tilejson);
 * await view.init();
 *
 * // Fetch a TileJSON document and register it as a source.
 * const source = await tilejson.addSource({
 *   type: "raster-tile",
 *   id: "basemap",
 *   url: "https://example.com/tiles.json",
 * });
 *
 * // Reference the source by handle...
 * view.addLayer({ type: "raster", source });
 * // ...or directly by the id passed above.
 * view.addLayer({ type: "raster", source: "basemap" });
 * ```
 */
import ThreeView, {
  Plugin,
  type Source,
  type ViewContext,
} from "@navara/three";
import type { DefaultDescriptions } from "@navara/three_default_plugin";

import type { AttributionPlugin } from "./AttributionPlugin";

type View = ThreeView<DefaultDescriptions>;

/** Matches a TileJSON version such as `"3.0.0"` (major.minor.patch). */
const TILEJSON_VERSION = /^\d+\.\d+\.\d+$/;

/**
 * The subset of a TileJSON 3.0.0 document this plugin consumes. Other spec
 * fields (`bounds`, `center`, `grids`, ...) are ignored.
 */
export type TileJson = {
  /** Semver of the TileJSON spec the document conforms to, e.g. `"3.0.0"`. */
  tilejson: string;
  /** Tile URL templates (`{z}/{x}/{y}`). Required and non-empty per the spec. */
  tiles: string[];
  /** Attribution/credit HTML shown through the AttributionPlugin. */
  attribution?: string;
  /** Minimum zoom level. Applied to raster sources only. @defaultValue 0 */
  minzoom?: number;
  /** Maximum zoom level. @defaultValue 30 */
  maxzoom?: number;
  /** Tiling scheme. `"tms"` flips the Y axis (raster sources only). @defaultValue "xyz" */
  scheme?: "xyz" | "tms";
};

/**
 * Which Navara source type a TileJSON document is materialized into. Declared by
 * the caller because TileJSON has no field that reliably distinguishes raster
 * imagery from vector tiles.
 */
export type TileJsonSourceType = "raster-tile" | "vector-tile";

/**
 * Describes a TileJSON tile source to register via {@link TileJsonPlugin.addSource}.
 * Mirrors the shape of {@link ThreeView.addSource}, except `url` is the TileJSON
 * document URL (not a tile template) — the plugin fetches it and derives the tile
 * URL, zoom range, and attribution from the document.
 */
export type TileJsonSourceDescription = {
  /** Navara source type to create, as in `addSource`. */
  type: TileJsonSourceType;
  /** URL of the TileJSON 3.0.0 document to fetch and expand. */
  url: string;
  /**
   * Optional caller-provided source id. Handy for referencing the source from
   * layers by id (`addLayer({ source: "<id>" })`) without holding the returned
   * handle. When omitted, the engine generates one.
   */
  id?: string;
};

/** Options for {@link TileJsonPlugin}. */
export type TileJsonPluginOptions = {
  /**
   * AttributionPlugin used to surface each TileJSON's `attribution` credit. Its
   * lifecycle is the caller's responsibility (register it via `view.addPlugin`).
   *
   * Note: attributions collected by this plugin are rendered by replacing the
   * shown list, so this AttributionPlugin should be dedicated to TileJSON-sourced
   * credits. This wiring is expected to be replaced by `view.attribution` in the
   * future.
   */
  attribution: AttributionPlugin;
};

/**
 * Validates the fields this plugin relies on. Throws with an actionable message
 * when the `tilejson` version or the `tiles` array is missing or malformed.
 */
function validateTileJson(doc: TileJson): void {
  if (
    typeof doc.tilejson !== "string" ||
    !TILEJSON_VERSION.test(doc.tilejson)
  ) {
    throw new Error(
      `TileJsonPlugin: invalid or missing "tilejson" version field (got ${JSON.stringify(doc.tilejson)}).`,
    );
  }
  if (!Array.isArray(doc.tiles) || doc.tiles.length === 0) {
    throw new Error(
      'TileJsonPlugin: "tiles" must be a non-empty array of URL templates.',
    );
  }
}

export class TileJsonPlugin extends Plugin<View, ViewContext> {
  private view?: View;
  private readonly attribution: AttributionPlugin;
  /** Credits collected from every added TileJSON, deduped and re-shown together. */
  private readonly credits: string[] = [];

  constructor(options: TileJsonPluginOptions) {
    super();
    this.attribution = options.attribution;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async init(view: View, _ctx: ViewContext): Promise<void> {
    this.view = view;
  }

  /**
   * Fetch a TileJSON document and register it as a single Navara source.
   *
   * `desc.url` is the TileJSON document URL; the plugin fetches it, then creates
   * one source of the requested `desc.type` using the document's first tile
   * endpoint, `minzoom`/`maxzoom`, and `scheme`. The document's `attribution` is
   * surfaced through the AttributionPlugin.
   *
   * A TileJSON `tiles` array lists mirror endpoints for the same tileset (as in
   * MapLibre, which shards requests across them). Navara sources take a single
   * URL, so only the first endpoint is used; extra endpoints are ignored with a
   * warning.
   *
   * Must be called after `view.init()`. Returns the created {@link Source}
   * handle; layers can reference it by handle or by `desc.id`.
   */
  async addSource(desc: TileJsonSourceDescription): Promise<Source> {
    const view = this.view;
    if (!view) {
      throw new Error(
        "TileJsonPlugin: addSource() must be called after view.init().",
      );
    }

    const doc = await this.fetchTileJson(desc.url);
    validateTileJson(doc);

    // `tiles` lists mirror endpoints for one tileset; Navara sources take a
    // single URL, so use the first and note any dropped mirrors.
    const [url, ...mirrors] = doc.tiles;
    if (mirrors.length > 0) {
      console.warn(
        `TileJsonPlugin: TileJSON at ${desc.url} lists ${doc.tiles.length} mirror ` +
          `tile endpoints; Navara sources use a single URL, so only the first is used.`,
      );
    }

    const { minzoom, maxzoom, scheme } = doc;
    const id = desc.id;
    const source =
      desc.type === "raster-tile"
        ? view.addSource({
            type: "raster-tile",
            url,
            ...(id !== undefined ? { id } : {}),
            ...(minzoom !== undefined ? { minZoom: minzoom } : {}),
            ...(maxzoom !== undefined ? { maxZoom: maxzoom } : {}),
            ...(scheme === "tms" ? { tms: true } : {}),
          })
        : // vector-tile sources have no minZoom / tms fields in the engine, so
          // only maxzoom carries over.
          view.addSource({
            type: "vector-tile",
            url,
            ...(id !== undefined ? { id } : {}),
            ...(maxzoom !== undefined ? { maxZoom: maxzoom } : {}),
          });

    if (doc.attribution) {
      this.addCredit(doc.attribution);
    }

    return source;
  }

  dispose(): void {
    // The AttributionPlugin is owned by the caller, so it is not disposed here.
    this.credits.length = 0;
  }

  private async fetchTileJson(url: string): Promise<TileJson> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(
        `TileJsonPlugin: failed to fetch TileJSON from ${url} (${res.status} ${res.statusText})`,
      );
    }
    return (await res.json()) as TileJson;
  }

  /** Collect a credit and re-render the merged, de-duplicated list. */
  private addCredit(attribution: string): void {
    if (this.credits.includes(attribution)) return;
    this.credits.push(attribution);
    this.attribution.show(
      this.credits.map((attributionHtml) => ({ attributionHtml })),
    );
  }
}
