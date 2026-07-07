/**
 * CesiumIonPlugin — Navara Plugin for Cesium Ion quantized-mesh terrain.
 *
 * Resolves a Cesium Ion asset endpoint at `init()` time and exposes
 * `addTerrain()` to register the asset as a terrain layer on the view.
 *
 * ## Usage
 *
 * ```ts
 * import ThreeView from "@navara/three";
 * import { DefaultPlugin } from "@navara/three_default_plugin";
 * import { CesiumIonPlugin } from "@navara/three_plugins";
 *
 * const view = new ThreeView({ container, animation: true });
 * const cesiumIon = new CesiumIonPlugin({
 *   assetId: 12345,
 *   accessToken: "<your cesium ion token>",
 * });
 *
 * view.addPlugin(new DefaultPlugin());
 * view.addPlugin(cesiumIon);
 * await view.init();
 *
 * cesiumIon.addTerrain({
 *   maxZoom: 14,
 *   castShadow: true,
 *   receiveShadow: true,
 *   tms: true,
 *   geographic: true,
 *   requestVertexNormals: true,
 *   requestWaterMask: true,
 * });
 * ```
 */
import ThreeView, {
  Plugin,
  type QuantizedMeshSource,
  type TerrainSourceLayer,
  type ViewContext,
} from "@navara/three";
import type { DefaultDescriptions } from "@navara/three_default_plugin";

type View = ThreeView<DefaultDescriptions>;

const CESIUM_ION_API = "https://api.cesium.com/v1/assets";

export type CesiumIonConfig = {
  /** Cesium Ion asset id. */
  assetId: number | string;
  /** Cesium Ion access token used to resolve the asset endpoint. */
  accessToken: string;
  endpoint?: string;
};

/**
 * Quantized-mesh fetch/decode options forwarded to the source.
 * The `url` and `token` fields are provided by the plugin from the resolved
 * Cesium Ion endpoint.
 */
export type CesiumIonSourceOptions = Omit<
  QuantizedMeshSource,
  "type" | "url" | "token" | "id"
>;

/** Terrain mesh rendering options forwarded to the terrain layer. */
export type CesiumIonTerrainRenderOptions = NonNullable<
  TerrainSourceLayer["terrain"]
>;

/**
 * Options for {@link CesiumIonPlugin.addTerrain}. A flat object combining the
 * quantized-mesh source's fetch/decode options with the terrain layer's render
 * options; the plugin routes each field to the source or the layer.
 */
export type CesiumIonTerrainOptions = CesiumIonSourceOptions &
  CesiumIonTerrainRenderOptions;

type CesiumIonEndpoint = {
  url: string;
  accessToken: string;
};

export class CesiumIonPlugin extends Plugin<View, ViewContext> {
  private view?: View;
  private readonly config: CesiumIonConfig;
  private endpoint?: CesiumIonEndpoint;

  constructor(config: CesiumIonConfig) {
    super();
    this.config = config;
  }

  async init(view: View, _ctx: ViewContext): Promise<void> {
    this.view = view;

    const { assetId, accessToken, endpoint = CESIUM_ION_API } = this.config;
    const url = `${endpoint}/${encodeURIComponent(String(assetId))}/endpoint?access_token=${encodeURIComponent(accessToken)}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(
        `CesiumIonPlugin: failed to fetch asset ${assetId} endpoint (${res.status} ${res.statusText})`,
      );
    }
    const json = (await res.json()) as CesiumIonEndpoint;
    this.endpoint = { url: json.url, accessToken: json.accessToken };
  }

  /**
   * Register the resolved Cesium Ion asset as a quantized-mesh terrain layer.
   * Must be called after `view.init()`.
   *
   * Internally this creates an implicit quantized-mesh source for the asset and
   * a terrain layer that references it. The source is owned by the returned
   * layer: deleting the layer reclaims the source too, so callers only manage
   * the layer handle.
   */
  addTerrain(options: CesiumIonTerrainOptions = {}) {
    if (!this.view || !this.endpoint) {
      throw new Error(
        "CesiumIonPlugin: addTerrain() must be called after view.init().",
      );
    }

    const {
      castShadow,
      receiveShadow,
      show,
      showBoundingBox,
      skirt,
      skirtExaggeration,
      ...sourceOptions
    } = options;

    const source = this.view.addSource({
      type: "quantized-mesh",
      url: `${this.endpoint.url}{z}/{x}/{y}.terrain`,
      token: this.endpoint.accessToken,
      ...sourceOptions,
    });

    const layer = this.view.addLayer({
      type: "terrain",
      source,
      terrain: {
        castShadow,
        receiveShadow,
        show,
        showBoundingBox,
        skirt,
        skirtExaggeration,
      },
    });

    // The source is implicit — the caller only holds the layer handle — so
    // reclaim it once the layer is deleted.
    layer.once("deleted", () => source.delete());

    return layer;
  }
}
