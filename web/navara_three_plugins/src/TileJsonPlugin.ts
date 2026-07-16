/**
 * TileJsonPlugin — Navara Plugin for TileJSON 3.0.0 tile sources.
 *
 * Fetches a
 * {@link https://github.com/mapbox/tilejson-spec/tree/master/3.0.0 | TileJSON 3.0.0}
 * document and registers it as a single Navara source. {@link TileJsonPlugin.addSource}
 * mirrors {@link ThreeView.addSource}: a discriminated `type` plus an optional
 * `id`, with `url` pointing at the TileJSON document. The plugin derives the tile
 * URL, `minzoom`/`maxzoom`, and `scheme` from the document.
 *
 * Each document's `attribution` is surfaced automatically through the view's
 * built-in attribution UI (`view.attribution`). Callers who want a custom credit
 * UI can opt out of the built-in one (`new ThreeView({ defaultAttribution: false })`)
 * and read credits from the {@link TileJsonPlugin.on | `loaded`} event instead.
 *
 * ## Usage
 *
 * ```ts
 * import ThreeView from "@navara/three";
 * import { TileJsonPlugin } from "@navara/three_plugins";
 *
 * const view = new ThreeView({ container });
 * const tilejson = new TileJsonPlugin();
 * view.addPlugin(tilejson);
 * await view.init();
 *
 * // Fetch a TileJSON document and register it as a source. Its `attribution`
 * // shows in the built-in credit UI automatically.
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
 *
 * ### Custom attribution UI
 *
 * ```ts
 * // Turn off the built-in UI and render credits yourself.
 * const view = new ThreeView({ container, defaultAttribution: false });
 * const tilejson = new TileJsonPlugin();
 * view.addPlugin(tilejson);
 * await view.init();
 *
 * tilejson.on("loaded", ({ source, attribution }) => {
 *   if (attribution) renderMyCredit(source.id, attribution);
 * });
 * ```
 */
import ThreeView, {
  Plugin,
  EventHandler,
  type Source,
  type ViewContext,
} from "@navara/three";
import type { DefaultDescriptions } from "@navara/three_default_plugin";

type View = ThreeView<DefaultDescriptions>;

/** Matches a TileJSON version such as "3.0.0" (major.minor.patch). */
const TILEJSON_VERSION = /^3\.\d+\.\d+$/;

/**
 * The subset of a TileJSON 3.0.0 document this plugin consumes. Other spec
 * fields (`bounds`, `center`, `grids`, ...) are ignored.
 */
export type TileJson = {
  /** Semver of the TileJSON spec the document conforms to, e.g. `"3.0.0"`. */
  tilejson: string;
  /** Tile URL templates (`{z}/{x}/{y}`). Required and non-empty per the spec. */
  tiles: string[];
  /** Attribution/credit HTML shown through the view's attribution UI. */
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

/** Detail passed to the {@link TileJsonPlugin} `loaded` event. */
export type TileJsonLoadedEvent = {
  /** The Navara source created for the document. */
  source: Source;
  /** The fetched and validated TileJSON document. */
  tilejson: TileJson;
  /** The document's `attribution` HTML, when it declares one. */
  attribution?: string;
};

/**
 * Events emitted by {@link TileJsonPlugin}. Subscribe via
 * {@link TileJsonPlugin.on} / {@link TileJsonPlugin.once}.
 */
export type TileJsonPluginEventMap = {
  /**
   * Fired once per successful {@link TileJsonPlugin.addSource}, after the source
   * is registered. Carries the created source, the parsed document, and its
   * attribution so callers can drive a custom credit UI.
   */
  loaded: (event: TileJsonLoadedEvent) => void;
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
  private readonly events = new EventHandler<TileJsonPluginEventMap>();
  /** Credits pushed into `view.attribution`, tracked so dispose() can drop them. */
  private readonly credits: string[] = [];

  async init(view: View, _ctx: ViewContext): Promise<void> {
    this.view = view;
  }

  /**
   * Subscribe to a plugin event. Use `loaded` to receive each document's
   * attribution (and the created source) for a custom credit UI.
   */
  on<E extends keyof TileJsonPluginEventMap>(
    event: E,
    listener: TileJsonPluginEventMap[E],
  ): void {
    this.events.on(event, listener);
  }

  /** Subscribe to a plugin event for a single emission, then auto-unsubscribe. */
  once<E extends keyof TileJsonPluginEventMap>(
    event: E,
    listener: TileJsonPluginEventMap[E],
  ): void {
    this.events.once(event, listener);
  }

  /** Remove a previously registered listener. */
  off<E extends keyof TileJsonPluginEventMap>(
    event: E,
    listener: TileJsonPluginEventMap[E],
  ): void {
    this.events.off(event, listener);
  }

  /**
   * Fetch a TileJSON document and register it as a single Navara source.
   *
   * `desc.url` is the TileJSON document URL; the plugin fetches it, then creates
   * one source of the requested `desc.type` using the document's first tile
   * endpoint, `minzoom`/`maxzoom`, and `scheme`. The document's `attribution` is
   * surfaced through the view's built-in attribution UI (`view.attribution`), and
   * a `loaded` event is emitted carrying the source, document, and attribution.
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

    this.events.emit("loaded", {
      source,
      tilejson: doc,
      attribution: doc.attribution,
    });

    return source;
  }

  dispose(): void {
    // Drop the credits this plugin contributed to the view-owned attribution UI
    // so a disposed plugin doesn't leave stale credits behind on a live view.
    // The view owns the UI's lifecycle; when the view is disposed first,
    // `view.attribution` is already gone and this is a no-op.
    const attribution = this.view?.attribution;
    if (attribution && this.credits.length > 0) {
      attribution.remove(
        this.credits.map((attributionHtml) => ({ attributionHtml })),
      );
    }
    this.credits.length = 0;
    this.events.clear("loaded");
    this.view = undefined;
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

  /**
   * Add a credit to the view's built-in attribution UI, deduped so repeated or
   * shared credits render once. No-op when the built-in UI is disabled
   * (`defaultAttribution: false`) — those callers use the `loaded` event instead.
   */
  private addCredit(attribution: string): void {
    if (this.credits.includes(attribution)) return;
    this.credits.push(attribution);
    this.view?.attribution?.add([{ attributionHtml: attribution }]);
  }
}
