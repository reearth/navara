import ThreeView, {
  Color,
  fetchFontFamilyFromCss,
  type FeatureEvaluator,
  type FontFamily,
  type Layer,
} from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";
import { Pane } from "tweakpane";

import { PMTILES_DATASETS, TERRAIN_DATASETS } from "../../helpers/constants";

import { createFaceMonitor } from "./faceMonitor";
import {
  ADMIN_FAMILY,
  ADMIN_OUTLINE_WIDTH,
  ADMIN_WEIGHT,
  cssUrl,
  FAMILY_NAMES,
  OVERTURE_COLORS,
} from "./fonts";

export type CustomDescriptions = DefaultDescriptions;

/**
 * Raster cartographic basemap (TileJSON 3.0.0, Protomaps-rendered OSM). A raster
 * basemap is deliberate: it is one draped texture per terrain tile, where the
 * vector equivalent would be thousands of polygons per tile competing with the
 * labels for the frame budget — and this page is about the labels.
 */
const BASEMAP_URL =
  "https://papers.reearth.land/styles/papers-light/tilejson.json";

/**
 * One stop per script. Each cut lands somewhere whose Overture `@name` values
 * are written in a script the font pipeline has not seen yet, so the face
 * monitor gains rows on arrival — that progression *is* the demo.
 *
 * `distance` is how far back along the view ray the camera sits from the target
 * point, so each city fills the frame with terrain receding behind it.
 */
const STOPS = [
  { name: "London", script: "Latin", lng: -0.1276, lat: 51.5072, heading: 20 },
  { name: "Athens", script: "Greek", lng: 23.7275, lat: 37.9838, heading: 340 },
  {
    name: "Moscow",
    script: "Cyrillic",
    lng: 37.6173,
    lat: 55.7558,
    heading: 0,
  },
  { name: "Cairo", script: "Arabic", lng: 31.2357, lat: 30.0444, heading: 250 },
  {
    name: "Yerevan",
    script: "Armenian",
    lng: 44.5152,
    lat: 40.1872,
    heading: 300,
  },
  {
    name: "Tbilisi",
    script: "Georgian",
    lng: 44.8271,
    lat: 41.7151,
    heading: 30,
  },
  {
    name: "Addis Ababa",
    script: "Ethiopic",
    lng: 38.7578,
    lat: 9.0192,
    heading: 15,
  },
  // Kathmandu, not Delhi: Overture's primary name for Indian cities around
  // Delhi is the Latin one ("New Delhi", "Gurugram"), so that stop added no
  // face at all. Nepal carries its localities in Devanagari.
  {
    name: "Kathmandu",
    script: "Devanagari",
    lng: 85.324,
    lat: 27.7172,
    heading: 20,
  },
  { name: "Bangkok", script: "Thai", lng: 100.5018, lat: 13.7563, heading: 45 },
  {
    name: "Seoul",
    script: "Hangul",
    lng: 126.978,
    lat: 37.5665,
    heading: 330,
  },
  {
    name: "Tokyo",
    script: "Japanese",
    lng: 139.6917,
    lat: 35.6895,
    heading: 300,
  },
] as const;

/**
 * How far back the camera sits, and how steeply it looks down.
 *
 * The pitch is not cosmetic. A shallow pitch runs the frustum to the horizon,
 * which multiplies the visible tile count for *every* source; the engine's
 * per-frame tile traversal is the main-thread bottleneck in a scene this wide,
 * so a steeper angle buys frame time directly.
 */
const STOP_DISTANCE = 45_000;
const STOP_PITCH = -50;

const stopCamera = (stop: (typeof STOPS)[number]) => ({
  lng: stop.lng,
  lat: stop.lat,
  distance: STOP_DISTANCE,
  heading: stop.heading,
  pitch: STOP_PITCH,
  roll: 0,
});

/**
 * The whole globe. Deliberately not the opening shot: Overture's `@name` is the
 * *local* primary name, so one world view asks for ~200 country names spanning
 * ~30 scripts and the pipeline correctly — but undramatically — fetches most of
 * the declared faces at once. Worth showing on purpose, after the per-city
 * story has landed.
 */
const WORLD_VIEW = {
  lng: 30,
  lat: 25,
  height: 22_000_000,
  heading: 0,
  pitch: -90,
  roll: 0,
};

/**
 * Admin tiers, coarsest first, keyed by Overture's stable `subtype` enum.
 * `declutterPriority` follows this order, so countries beat regions beat
 * counties beat localities wherever labels overlap.
 *
 * Three of Overture's eight subtypes are labeled. The sub-city ones
 * (`neighborhood`, `macrohood`, `microhood`) are what a city view is mostly
 * *made* of, and they are almost entirely noise for this demo: at the Tokyo
 * stop they are 197k `neighbourhood` features (the 丁目 block names), 79k
 * `quarter`, and 1.7k `city_block` ("四番地"); at London they are housing
 * estates ("Birds Hill Estate") and squares ("Jubilee Square"). `county` is
 * skipped for a different reason — it duplicates places the neighbouring tiers
 * already name, often in the other script (Overture carries Japanese cities as
 * both `locality/city` 船橋市 and `county/city` "Funabashi"). Dropping a tier
 * costs nothing to prove: the evaluator returns `text: ""`, so no glyph is
 * shaped and no face is fetched for it.
 *
 * `localTypes`, when present, further narrows a subtype by Overture's
 * `local_type`. `locality` needs it: it mixes real cities and towns (船橋市,
 * Reigate) with hundreds of villages and hamlets per view.
 *
 * `minZoom`/`maxZoom` is the band of camera zooms at which a tier is labeled;
 * together they cover 0–22 with only slight overlap, so roughly one tier reads
 * at a time. A globe keeps the whole tile pyramid resident, so without a band,
 * arriving at one city would ask for ~200 country names in ~30 scripts and the
 * per-script reveal this page exists to show would be over in one burst.
 */
const LABEL_TIERS: {
  key: string;
  subtype: string;
  localTypes?: string[];
  size: number;
  minZoom: number;
  maxZoom: number;
}[] = [
  { key: "country", subtype: "country", size: 19, minZoom: 0, maxZoom: 7.5 },
  { key: "region", subtype: "region", size: 16, minZoom: 6.5, maxZoom: 11.5 },
  {
    key: "locality",
    subtype: "locality",
    localTypes: ["city", "town"],
    size: 17,
    minZoom: 11,
    maxZoom: 22,
  },
];

/** Reverse index: `subtype` -> tier index. */
const TIER_INDEX_OF = new Map(LABEL_TIERS.map((tier, i) => [tier.subtype, i]));

/**
 * Overture ships `local_type` as a JSON *object* of locale → name
 * (`{"en":"city"}`), not a bare string — reading it raw silently matches
 * nothing. Prefer the English key, else any locale.
 */
const localTypeOf = (raw: string | undefined): string | undefined => {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return (parsed["en"] ?? Object.values(parsed)[0])?.toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
};

/**
 * Overture sets `text-transform: uppercase` on administrative labels, which is
 * every tier this page labels. Applied in the evaluator because Navara has no
 * `textTransform` property; `toLocaleUpperCase` leaves ideographs and other
 * caseless scripts untouched, so it is safe to run over every name regardless
 * of script.
 */
const overtureCase = (name: string) => name.toLocaleUpperCase();

export const run = async (view: ThreeView<CustomDescriptions>) => {
  view.addPlugin(new DefaultPlugin());
  const tilejson = new TileJsonPlugin();
  view.addPlugin(tilejson);

  const attribution = view.attribution;

  await view.init();

  // ---- Fonts ---------------------------------------------------------------
  // Only the *stylesheets* are downloaded here. `fetchFontFamilyFromCss` parses
  // the `@font-face` blocks into `{ url, unicodeRanges }` pairs — not one byte
  // of any face file is fetched until some label actually needs a codepoint in
  // its ranges. That is the whole point of this demo, and the face monitor below
  // watches the network to prove it.
  //
  // The Google Fonts CSS API orders @font-face blocks alphabetically, so pass
  // the stack as a `fontFamily` array to restore the intended priority (e.g. JP
  // before SC/KR for codepoints shared across CJK subsets).
  const family: FontFamily = await fetchFontFamilyFromCss(
    ADMIN_FAMILY,
    cssUrl(ADMIN_WEIGHT),
    { fontFamily: FAMILY_NAMES },
  );
  view.addFontFamily(family);

  // Declared faces in hand, the monitor can report "N of M fetched" and match
  // each network request back to the unicode range that triggered it.
  const faceMonitor = createFaceMonitor(
    [{ family, weight: ADMIN_WEIGHT }],
    FAMILY_NAMES,
  );

  // The font worker's own accounting (files held, glyphs rasterized into the
  // atlas), polled alongside the network view.
  const workerTimer = window.setInterval(() => {
    void view
      .workerMemoryStats()
      .then((stats) => faceMonitor.setWorkerStats(stats?.fontWorker));
  }, 1000);
  window.addEventListener("beforeunload", () => {
    window.clearInterval(workerTimer);
    faceMonitor.dispose();
  });

  // ---- Scene ---------------------------------------------------------------
  // Flat cartographic raster + SDF text are both unlit, so one ambient light is
  // all the scene needs; terrain shading comes from the basemap's own cartography.
  view.addLight({ ambient: {} });

  // Open on London: one city, one script, so the face monitor starts near empty
  // and every later cut visibly adds to it.
  view.setCamera(stopCamera(STOPS[0]));

  // Real elevation. This source is tiled in EPSG:4326 over the full [-90, 90]
  // latitude range, so the globe stays closed at both poles — a Web Mercator
  // terrain source would stop near ±85° and leave a hole there.
  //
  // `maxZoom` is capped well below the source's own z14: at this camera distance
  // one screen pixel covers tens of metres, so deeper terrain adds tiles the
  // view cannot resolve — and every extra terrain tile re-drapes the basemap and
  // re-clamps the labels riding on it.
  const terrainSource = view.addSource({
    type: "quantized-mesh",
    url: TERRAIN_DATASETS.reearthQuantizedMesh.url,
    maxZoom: 12,
    requestVertexNormals: true,
  });
  // `let`, because the Terrain toggle deletes and re-adds this layer.
  let terrainLayer: Layer | undefined = view.addLayer({
    type: "terrain",
    source: terrainSource,
    terrain: {},
  });

  // The basemap, draped over whatever surface exists. Added after terrain
  // because layer render order is add order.
  const basemapSource = await tilejson.addSource({
    type: "raster-tile",
    url: BASEMAP_URL,
    // The TileJSON advertises z22; the demo never gets closer than ~45 km, so
    // cap the pyramid rather than stream tiles finer than the view resolves.
    // (Lower-case `maxzoom`: these overrides mirror the TileJSON document's own
    // field names, not `addSource`'s camelCase ones.)
    maxzoom: 13,
  });
  const basemapLayer = view.addLayer({ type: "raster", source: basemapSource });

  // ---- Labels --------------------------------------------------------------
  // The only vector source on the page: Overture `divisions`, used for nothing
  // but the names. Every glyph from here down is produced by the font pipeline —
  // shaped in the font worker, rasterized into an SDF atlas, drawn as batched
  // quads.
  const divisionsSource = view.addSource({
    type: "vector-tile",
    url: PMTILES_DATASETS.overtureDivisions.url,
    // Ceiling only — never a `minZoom` floor. A floor does not mean "ignore this
    // source when zoomed out"; it means the traversal cannot satisfy a coarse
    // view with a coarse tile, so it keeps descending to the floor level across
    // the whole visible area. Zooming out from a city then spawns thousands of
    // z9 division tiles and their label features (measured: 120 FPS → 3 FPS).
    // Which features get *labeled* is decided by the zoom bands in
    // `LABEL_TIERS`, not by withholding tiles.
    maxZoom: 12,
  });

  const params = { sizeScale: 1.0, maxWidth: 9.0 };

  // Camera zoom, sampled outside the evaluator and cached here. See the note at
  // its use site: an evaluator callback may not call back into WASM, and
  // `view.camera.zoom` does exactly that.
  let cameraZoom: number | undefined = view.camera.zoom;

  /**
   * Builds the label layer and wires its evaluator.
   *
   * Unlike a visibility toggle, the "labels" switch below creates and destroys
   * this layer, so the whole thing must be re-creatable — the evaluator handlers
   * are attached per layer instance, hence the factory. Reads `params` at call
   * time, so a layer re-added after the sliders moved comes back current.
   */
  const createLabelLayer = (): Layer =>
    view.addLayer({
      type: "vector",
      source: divisionsSource,
      sourceLayers: ["division"],
      text: {
        font: ADMIN_FAMILY,
        color: new Color().setStyle(OVERTURE_COLORS.adminText),
        size: LABEL_TIERS[0].size,
        sizeInMeters: false,
        // Terrain here is real elevation, so labels ride the surface rather than
        // sinking into a mountain at ellipsoid height.
        clampToGround: true,
        center: { x: 0.5, y: -0.5 },
        outlineColor: new Color().setStyle(OVERTURE_COLORS.adminHalo),
        outlineWidth: ADMIN_OUTLINE_WIDTH,
        outlineOpacity: OVERTURE_COLORS.adminHaloOpacity,
        offsetDepth: true,
        depthTest: true,
        maxWidth: params.maxWidth,
      },
    });

  const applyLabelEvaluator = ({
    evaluator,
  }: {
    evaluator: FeatureEvaluator;
  }) => {
    evaluator.evaluate(
      ({ properties }) => {
        // Overture stores the localized primary name under `@name` — Arabic in
        // Egypt, Devanagari in India, Japanese in Japan. Nothing here selects a
        // script: the registered family resolves the right face per glyph.
        let name = properties?.["@name"] as string | undefined;
        if (!name) return { text: "", show: false };

        // Tier by the stable `subtype` enum. Anything outside the four labeled
        // subtypes — every sub-city division — is never labeled.
        const subtype = (
          properties?.["subtype"] as string | undefined
        )?.toLowerCase();
        const tierIndex =
          subtype !== undefined ? TIER_INDEX_OF.get(subtype) : undefined;
        if (tierIndex === undefined) return { text: "", show: false };

        const tier = LABEL_TIERS[tierIndex];

        // Narrow by `local_type` where the subtype alone is too broad.
        if (tier.localTypes) {
          const localType = localTypeOf(
            properties?.["local_type"] as string | undefined,
          );
          if (localType === undefined || !tier.localTypes.includes(localType)) {
            return { text: "", show: false };
          }
        }

        // Zoom band, read from the cached `cameraZoom` — never from
        // `view.camera.zoom`. An evaluator callback runs *inside* the engine's
        // WASM feature-evaluation call, and `camera.zoom` calls back into WASM
        // (`Core.getZoomLevel`), which throws "recursive use of an object
        // detected which would lead to unsafe aliasing in rust". Evaluators must
        // touch plain JS state only. `undefined` until the first camera settle —
        // band nothing out then, and let the `moveend` handler re-evaluate.
        if (
          cameraZoom !== undefined &&
          (cameraZoom < tier.minZoom || cameraZoom > tier.maxZoom)
        ) {
          return { text: "", show: false };
        }

        // Replace `/` with a line break (Overture joins bilingual names so).
        name = name.replace(/\s*\/\s*/g, "\n");

        return {
          text: overtureCase(name),
          show: true,
          size: tier.size * params.sizeScale,
          declutterPriority: LABEL_TIERS.length - tierIndex,
        };
      },
      { filters: ["@name", "subtype", "local_type"] },
    );
  };

  const addLabelLayer = (): Layer => {
    const layer = createLabelLayer();
    layer.on("featureCreated", applyLabelEvaluator);
    layer.on("featureUpdated", applyLabelEvaluator);
    return layer;
  };

  // `undefined` while the layer is deleted.
  let labelLayer: Layer | undefined = addLabelLayer();

  // The evaluator bands features by `cameraZoom`, so its verdicts go stale the
  // moment the camera moves.
  //
  // Sample it from `postUpdate`, not from the camera's own `moveend`. Those
  // status events are raised by the camera *controller*, so they cover a drag
  // or a wheel zoom but never a programmatic `setCamera` — every "Fly to"
  // button below. With `moveend` the zoom stayed frozen at its startup value
  // for the whole session (verified: zero events), which the city stops hid by
  // all sharing one zoom while the World button silently showed no labels at
  // all until you nudged the wheel. `postUpdate` runs after feature evaluation
  // completes, which is the one place `camera.zoom` — itself a WASM call — is
  // safe to make.
  //
  // Re-run the evaluators only when the set of active tiers actually changes:
  // `forceUpdate` re-emits `featureUpdated` for every loaded tile, far too
  // heavy to do on every frame of a drag.
  const activeTierKey = (zoom: number | undefined) =>
    zoom === undefined
      ? "*"
      : LABEL_TIERS.filter((t) => zoom >= t.minZoom && zoom <= t.maxZoom)
          .map((t) => t.key)
          .join(",");
  let lastTierKey = activeTierKey(cameraZoom);
  view.on("postUpdate", () => {
    cameraZoom = view.camera.zoom;
    const key = activeTierKey(cameraZoom);
    if (key === lastTierKey) return;
    lastTierKey = key;
    labelLayer?.forceUpdate();
    view.forceUpdate();
  });

  // ---- Control panel -------------------------------------------------------
  const pane = new Pane({ title: "Navara font pipeline — FOSS4G" });

  // The demo's spine: each cut lands where the names are written in a script the
  // pipeline has not seen, so the face monitor gains a row.
  const stopsFolder = pane.addFolder({ title: "Fly to", expanded: true });
  for (const stop of STOPS) {
    stopsFolder
      .addButton({ title: `${stop.name} — ${stop.script}` })
      .on("click", () => view.setCamera(stopCamera(stop)));
  }
  stopsFolder
    .addButton({ title: "World — every script at once" })
    .on("click", () => view.setCamera({ ...WORLD_VIEW }));

  const labelFolder = pane.addFolder({ title: "Labels" });

  // Not a visibility toggle: it destroys and rebuilds the layer. Deleting
  // releases its text batches and tile subscriptions instead of merely drawing
  // nothing — and the font worker's file/glyph counts in the monitor drop with
  // it, which is the other half of the lifecycle story.
  const labelState = { show: true };
  labelFolder
    .addBinding(labelState, "show", { label: "labels" })
    .on("change", ({ value }) => {
      if (value) {
        labelLayer ??= addLabelLayer();
      } else {
        labelLayer?.delete();
        labelLayer = undefined;
      }
      view.forceUpdate();
    });

  labelFolder
    .addBinding(params, "sizeScale", {
      min: 0.4,
      max: 4,
      step: 0.1,
      label: "size ×",
    })
    .on("change", () => {
      labelLayer?.forceUpdate();
      view.forceUpdate();
    });

  labelFolder
    .addBinding(params, "maxWidth", {
      min: 0,
      max: 20,
      step: 0.5,
      label: "max width (em)",
    })
    .on("change", ({ value }) => {
      labelLayer?.update({ text: { maxWidth: value } });
      view.forceUpdate();
    });

  const sceneFolder = pane.addFolder({ title: "Scene", expanded: false });

  const basemapState = { show: true };
  sceneFolder
    .addBinding(basemapState, "show", { label: "basemap" })
    .on("change", ({ value }) => {
      basemapLayer.update({ raster: { show: value } });
      view.forceUpdate();
    });

  const terrainState = { show: true };
  sceneFolder
    .addBinding(terrainState, "show", { label: "quantized mesh" })
    .on("change", ({ value }) => {
      // `terrain.update({ show: false })` has no visible effect — deleting the
      // layer is what drops the surface back to the flat ellipsoid, and the
      // draped basemap re-drapes automatically.
      if (value) {
        terrainLayer ??= view.addLayer({
          type: "terrain",
          source: terrainSource,
          terrain: {},
        });
      } else {
        terrainLayer?.delete();
        terrainLayer = undefined;
      }
      view.forceUpdate();
    });

  attribution?.add([
    TERRAIN_DATASETS.reearthQuantizedMesh,
    PMTILES_DATASETS.overtureDivisions,
  ]);
};
