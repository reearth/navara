import ThreeView, {
  Color,
  fetchFontFamilyFromCss,
  type FeatureEvaluator,
  type Layer,
} from "@navara/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";
import { SphericalHarmonics3 } from "three";
import { Pane } from "tweakpane";

import { PMTILES_DATASETS } from "../../helpers/constants";
import { SH_COEFFICIENTS } from "../../helpers/sh";

export type CustomDescriptions = DefaultDescriptions;

// Family name the label faces are registered under.
const LABEL_FONT = "OvertureLabels";

// Fonts covering the scripts Overture place names use, in priority order:
// Archivo (Expanded ExtraBold) for Latin, Noto Sans script fonts for the
// rest. Faces and their unicode ranges are derived from the Google Fonts
// stylesheet at runtime; font files themselves are still downloaded lazily,
// only when a label needs one of their codepoints.
//
// Order matters: for each codepoint the first face whose declared ranges
// contain it wins, and Google's declared ranges are per-subset boilerplate
// that can claim codepoints a font doesn't actually contain (which would
// shape as tofu). This order was verified against the fonts' real coverage:
// - Bengali/Devanagari/Armenian/Gurmukhi/Syriac precede Noto Sans, which
//   declares (but lacks) some of their signs, e.g. Vedic marks.
// - Noto Sans and JP/KR precede the remaining script fonts so shared
//   symbols/punctuation resolve to fonts that really contain them.
// - SC and Mongolian go last: Google slices them like CJK fonts whose
//   declared ranges also claim Hiragana, Hangul, Armenian, Arabic, Thai,
//   Cherokee, and more that these fonts don't cover.
const LABEL_FONT_STACK = [
  "Archivo:wdth,wght@125,800",
  "Noto Sans Bengali:wght@800",
  "Noto Sans Devanagari:wght@800",
  "Noto Sans Armenian:wght@800",
  "Noto Sans Gurmukhi:wght@800",
  "Noto Sans Arabic:wght@800",
  "Noto Sans Syriac:wght@800",
  "Noto Sans:wght@800",
  "Noto Sans JP:wght@800",
  "Noto Sans KR:wght@800",
  "Noto Sans Hebrew:wght@800",
  "Noto Sans Thaana:wght@800",
  "Noto Sans NKo",
  "Noto Sans Thai:wght@800",
  "Noto Sans Lao:wght@800",
  "Noto Sans Khmer:wght@800",
  "Noto Sans Myanmar:wght@800",
  "Noto Sans Gujarati:wght@800",
  "Noto Sans Tamil:wght@800",
  "Noto Sans Telugu:wght@800",
  "Noto Sans Kannada:wght@800",
  "Noto Sans Malayalam:wght@800",
  "Noto Sans Oriya:wght@800",
  "Noto Sans Sinhala:wght@800",
  "Noto Sans Georgian:wght@800",
  "Noto Sans Ethiopic:wght@800",
  "Noto Serif Tibetan:wght@800",
  "Noto Sans Tifinagh",
  "Noto Sans Adlam:wght@700",
  "Noto Sans Cherokee:wght@800",
  "Noto Sans Canadian Aboriginal:wght@800",
  "Noto Sans Vai",
  "Noto Sans Yi",
  "Noto Sans Osmanya",
  "Noto Sans SC:wght@800",
  "Noto Sans Mongolian",
];

const LABEL_FONT_CSS_URL = `https://fonts.googleapis.com/css2?${LABEL_FONT_STACK.map(
  (family) => `family=${family.replace(/ /g, "+")}`,
).join("&")}`;

// Camera presets.
const VIEWPOINTS = {
  World: { lng: 10, lat: 25, height: 22_000_000, pitch: -90 },
  Europe: { lng: 12, lat: 48, height: 4_500_000, pitch: -90 },
  "East Asia": { lng: 121, lat: 33, height: 5_000_000, pitch: -90 },
  Americas: { lng: -95, lat: 35, height: 8_000_000, pitch: -90 },
  "Tokyo (street)": { lng: 139.767, lat: 35.679, height: 1_000, pitch: -35 },
} as const;

// Admin tiers, coarsest first. They only feed declutter priority: labels are
// always candidates, and the screen-space declutter pass decides what fits —
// countries beat regions beat counties beat localities wherever they overlap.
// (The tile pyramid still gates data naturally: fine admin features only
// exist in higher-zoom tiles, so the world view never even loads them.)
const LABEL_TIERS = [
  {
    key: "country",
    match: ["country"],
  },
  {
    key: "region",
    match: ["region", "macroregion", "governorate", "province", "state"],
  },
  {
    key: "county",
    match: ["county", "macrocounty", "localadmin", "district"],
  },
  {
    key: "locality",
    match: ["locality", "city", "town"],
  },
];

// Reverse index: normalized property value -> tier index (first tier wins).
const TIER_INDEX_OF = new Map<string, number>();
LABEL_TIERS.forEach((tier, i) => {
  for (const value of tier.match) {
    if (!TIER_INDEX_OF.has(value)) TIER_INDEX_OF.set(value, i);
  }
});

// Within the finest (`locality`) tier, keep only large cities.
const CITY_POPULATION_THRESHOLD = 1_000_000;

const BASE_POLYGONS = [
  { title: "Land", source: "land", color: "#f8f4f1" }, // sand.50
  { title: "Land cover", source: "land_cover", color: "#c4eaa9" }, // grass fallback
  { title: "Land use", source: "land_use", color: "#d6ecd5" }, // park green.200
  { title: "Water", source: "water", color: "#79cdf6" }, // ocean.900
] as const;

// 3D buildings (Overture `buildings` theme). Where `height` (meters) is missing
// we estimate from `num_floors` (~3 m each), else fall back to a small default.
const BUILDING_COLOR = "#cabfb3"; // sand.300
const METERS_PER_FLOOR = 3;
const DEFAULT_BUILDING_HEIGHT = 6;

const LAND_COVER_COLORS: Record<string, string> = {
  forest: "#a2e2a4", // green.500
  mangrove: "#a1e3cf", // teal.100
  grass: "#c4eaa9", // green.400
  shrub: "#d8eaae", // olive.200
  crop: "#ebedb1", // yellow.300
  wetland: "#afe9e7", // teal.50
  moss: "#95daaa", // green.600
  barren: "#efe8cd", // yellow.200
  snow: "#f3f5f7", // sky.50
  urban: "#e8ded4", // sand.400
};

const POI_CATEGORIES = [
  { key: "Restaurants", icon: "/icons/restaurant.svg" },
  { key: "Cafés", icon: "/icons/cafe.svg" },
  { key: "Hotels", icon: "/icons/hotel.svg" },
  { key: "Schools", icon: "/icons/school.svg" },
  { key: "Hospitals", icon: "/icons/hospital.svg" },
  { key: "Shopping", icon: "/icons/shopping.svg" },
] as const;

type PoiKey = (typeof POI_CATEGORIES)[number]["key"];

// Place names are far more numerous and glyph-diverse than admin labels, so
// the text is gated harder than the icons: a place gets a label only when its
// `confidence` clears a higher floor than the icon needs. This bounds how many
// distinct strings the text shaper handles at once; on-screen readability is
// the declutter pass's job. Icons are unaffected.
const POI_LABEL_MIN_CONFIDENCE = 0.9;

// Deterministic [0,1] hash (FNV-1a) of a string. The screen-space declutter
// pass handles label overlap, but icons opt out of it (see the POI layer) and
// decluttering only hides at render time — it doesn't reduce how many features
// are batched and shaped. So dense areas (e.g. Tokyo street level) are also
// thinned data-side: hash a stable per-feature key and keep only points below
// a density threshold. This caps how many icon/label pairs exist at all, is
// stable across re-evaluation (nothing flickers on pan/zoom), and thins
// roughly uniformly across space.
const hash01 = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0xffffffff;
};

// Map an Overture place to an icon category (or `undefined` to skip).
// `taxonomy` is a JSON string whose `hierarchy[0]` is the broad bucket;
// `basic_category` is finer, used only to split cafés out of food_and_drink.
const classifyPlace = (
  properties: Record<string, unknown> | undefined,
): PoiKey | undefined => {
  const basic = properties?.["basic_category"] as string | undefined;
  if (basic === "cafe" || basic === "coffee_shop") return "Cafés";

  const taxonomyRaw = properties?.["taxonomy"] as string | undefined;
  if (!taxonomyRaw) return undefined;
  let bucket: string | undefined;
  try {
    bucket = (JSON.parse(taxonomyRaw) as { hierarchy?: string[] })
      .hierarchy?.[0];
  } catch {
    return undefined;
  }

  switch (bucket) {
    case "food_and_drink":
      return "Restaurants";
    case "lodging":
      return "Hotels";
    case "education":
      return "Schools";
    case "health_care":
      return "Hospitals";
    case "shopping":
      return "Shopping";
    default:
      return undefined;
  }
};

export const run = async (view: ThreeView<CustomDescriptions>) => {
  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  const attribution = view.attribution;

  await view.init();

  // The Google Fonts CSS API orders @font-face blocks alphabetically, so
  // pass the stack as a fontFamily array to restore the intended priority
  // (e.g. JP before SC/KR for codepoints shared across CJK subsets).
  view.addFontFamily(
    await fetchFontFamilyFromCss(LABEL_FONT, LABEL_FONT_CSS_URL, {
      fontFamily: LABEL_FONT_STACK.map((family) => family.split(":")[0]),
    }),
  );

  view.addLight({ ambient: {} });
  view.addLight({
    lightProbe: {
      sh: new SphericalHarmonics3().set(SH_COEFFICIENTS.white),
      intensity: 1,
    },
  });

  view.setCamera({ ...VIEWPOINTS.World, heading: 0, roll: 0 });

  view.addLayer({ type: "terrain", ellipsoid: {} });

  // One vector-tile source per `.pmtiles` archive (PMTiles is detected from the
  // URL extension); every layer references its archive's source and selects
  // which MVT sublayer to style via `sourceLayers`.
  const baseSource = view.addSource({
    type: "vector-tile",
    url: PMTILES_DATASETS.overtureBase.url,
    maxZoom: 13,
  });
  const divisionsSource = view.addSource({
    type: "vector-tile",
    url: PMTILES_DATASETS.overtureDivisions.url,
    // Finer admin features (governorate/district) exist only in higher-zoom
    // tiles, so fetch to z12 and let the altitude tiers keep the view uncluttered.
    maxZoom: 12,
  });
  const buildingsSource = view.addSource({
    type: "vector-tile",
    url: PMTILES_DATASETS.overtureBuildings.url,
    maxZoom: 14,
  });
  const placesSource = view.addSource({
    type: "vector-tile",
    url: PMTILES_DATASETS.overturePlaces.url,
    maxZoom: 14,
  });

  // Visibility is driven per-feature via each layer's evaluator, not the
  // material's `show` (which only seeds future features). The evaluator restyles
  // already-batched geometry, so toggling affects what's already on screen.
  const visible: Record<string, boolean> = {};

  const toggles: { title: string; layer: Layer }[] = [];

  // Precompute per-subtype Color instances (the evaluator runs per feature).
  const landCoverColors: Record<string, Color> = Object.fromEntries(
    Object.entries(LAND_COVER_COLORS).map(([k, hex]) => [
      k,
      new Color().setStyle(hex),
    ]),
  );

  for (const { title, source, color } of BASE_POLYGONS) {
    visible[title] = true;
    const layer = view.addLayer({
      type: "vector",
      source: baseSource,
      sourceLayers: [source],
      polygon: {
        color: new Color().setStyle(color),
        clampToGround: true,
      },
    });

    // `land_cover` additionally colors each feature by its `subtype`.
    const apply = ({ evaluator }: { evaluator: FeatureEvaluator }) => {
      if ((source as string) === "land_cover") {
        evaluator.evaluate(
          ({ properties }) => {
            const subtype = properties?.["subtype"] as string | undefined;
            const subtypeColor = subtype ? landCoverColors[subtype] : undefined;
            return subtypeColor
              ? { show: visible[title], color: subtypeColor }
              : { show: visible[title] };
          },
          { filters: ["subtype"] },
        );
      } else {
        evaluator.evaluate(() => ({ show: visible[title] }), { filters: [] });
      }
    };
    layer.on("featureCreated", apply);
    layer.on("featureUpdated", apply);

    toggles.push({ title, layer });
  }

  // Administrative boundaries from the `divisions` theme.
  const boundaryTitle = "Boundaries";
  visible[boundaryTitle] = true;
  const boundaryLayer = view.addLayer({
    type: "vector",
    source: divisionsSource,
    sourceLayers: ["division_boundary"],
    polyline: {
      color: new Color().setStyle("#757575"), // division.boundary gray.700
      width: 1.5,
      height: 1,
      clampToGround: true,
    },
  });
  {
    const apply = ({ evaluator }: { evaluator: FeatureEvaluator }) => {
      evaluator.evaluate(() => ({ show: visible[boundaryTitle] }), {
        filters: [],
      });
    };
    boundaryLayer.on("featureCreated", apply);
    boundaryLayer.on("featureUpdated", apply);
    toggles.push({ title: boundaryTitle, layer: boundaryLayer });
  }

  // 3D buildings from the `buildings` theme. Footprints are extruded by the
  // per-feature `extrudedHeight` (meters)
  //
  // Two MVT layers cooperate (OSM/Overture 3D convention):
  //   • `building`      — one footprint per building (bulk massing).
  //   • `building_part` — detailed sub-volumes for buildings modeled in 3D.
  // Where a footprint `has_parts` we hide it and let its parts stand in, else
  // the two double-draw and z-fight.
  const buildingsTitle = "Buildings";
  visible[buildingsTitle] = true;
  const buildingColor = new Color().setStyle(BUILDING_COLOR);

  // Bulk footprints. Hidden where `has_parts`, so detailed parts represent them.
  const buildingLayer = view.addLayer({
    type: "vector",
    source: buildingsSource,
    sourceLayers: ["building"],
    polygon: {
      color: buildingColor,
      // Seeds the attribute slots; the evaluator overrides height per feature.
      height: 0,
      extrudedHeight: 0,
      clampToGround: false,
    },
  });
  {
    const apply = ({ evaluator }: { evaluator: FeatureEvaluator }) => {
      evaluator.evaluate(
        ({ properties }) => {
          if (!visible[buildingsTitle]) return { show: false };
          // Buildings with detailed parts are drawn by the part layer instead.
          if (properties?.["has_parts"] === true) return { show: false };

          const height = properties?.["height"] as number | undefined;
          const numFloors = properties?.["num_floors"] as number | undefined;
          const extrudedHeight =
            height ??
            (numFloors != null
              ? numFloors * METERS_PER_FLOOR
              : DEFAULT_BUILDING_HEIGHT);

          return { show: true, extrudedHeight };
        },
        { filters: ["height", "num_floors", "has_parts"] },
      );
    };
    buildingLayer.on("featureCreated", apply);
    buildingLayer.on("featureUpdated", apply);
    toggles.push({ title: buildingsTitle, layer: buildingLayer });
  }

  // Detailed building parts. A part spans `min_height` (base) to `height` (top),
  // so base -> `height` attribute, top -> `extrudedHeight`; this keeps stacked
  // setbacks from overlapping and lets towers float above their podium.
  const buildingPartLayer = view.addLayer({
    type: "vector",
    source: buildingsSource,
    sourceLayers: ["building_part"],
    polygon: {
      color: buildingColor,
      height: 0,
      extrudedHeight: 0,
      clampToGround: false,
    },
  });
  {
    const apply = ({ evaluator }: { evaluator: FeatureEvaluator }) => {
      evaluator.evaluate(
        ({ properties }) => {
          if (!visible[buildingsTitle]) return { show: false };

          const top = properties?.["height"] as number | undefined;
          const numFloors = properties?.["num_floors"] as number | undefined;
          const base = (properties?.["min_height"] as number | undefined) ?? 0;
          const extrudedHeight =
            top ??
            (numFloors != null
              ? numFloors * METERS_PER_FLOOR
              : DEFAULT_BUILDING_HEIGHT);

          // Skip degenerate parts whose base is at or above their top.
          if (extrudedHeight <= base) return { show: false };

          return { show: true, height: base, extrudedHeight };
        },
        { filters: ["height", "num_floors", "min_height"] },
      );
    };
    buildingPartLayer.on("featureCreated", apply);
    buildingPartLayer.on("featureUpdated", apply);
    // Same title as the footprint layer: one "Buildings" toggle drives both
    // (the panel dedupes the repeated title).
    toggles.push({ title: buildingsTitle, layer: buildingPartLayer });
  }

  // Labels. Overture stores the localized primary name under `@name`; the
  // registered font family resolves the correct face per glyph. Visibility is
  // handled entirely by the screen-space declutter pass — no camera-altitude
  // gating: whatever fits on screen shows, coarser tiers winning overlaps.
  const labelTitle = "Labels";
  visible[labelTitle] = true;
  const params = { size: 15, maxWidth: 9.0 };

  const labelLayer = view.addLayer({
    type: "vector",
    source: divisionsSource,
    sourceLayers: ["division"],
    text: {
      font: LABEL_FONT,
      color: new Color().setStyle("#000000"),
      size: params.size,
      sizeInMeters: false,
      clampToGround: false,
      center: { x: 0.5, y: 0.5 },
      outlineColor: new Color().setStyle("#ffffff"),
      outlineWidth: 5,
      outlineOpacity: 0.4,
      offsetDepth: true,
      depthTest: true,
      maxWidth: params.maxWidth,
      // Screen-overlapping labels are hidden by priority (set per feature
      // from the admin tier in the evaluator below).
      declutter: true,
    },
  });

  {
    const apply = ({ evaluator }: { evaluator: FeatureEvaluator }) => {
      evaluator.evaluate(
        ({ properties }) => {
          if (!visible[labelTitle]) return { show: false };

          let name = properties?.["@name"] as string | undefined;
          if (!name) return { text: "", show: false };

          // Assign a priority tier: prefer locale-specific `local_type`, fall
          // back to the stable `subtype` enum. Unrecognized is never labeled.
          const localType = (
            properties?.["local_type"] as string | undefined
          )?.toLowerCase();
          const subtype = (
            properties?.["subtype"] as string | undefined
          )?.toLowerCase();
          const tierIndex =
            (localType !== undefined
              ? TIER_INDEX_OF.get(localType)
              : undefined) ??
            (subtype !== undefined ? TIER_INDEX_OF.get(subtype) : undefined);
          if (tierIndex === undefined) return { text: "", show: false };

          const tier = LABEL_TIERS[tierIndex];

          // Within the locality tier, still keep only the largest cities.
          if (tier.key === "locality") {
            const population = properties?.["population"] as number | undefined;
            if ((population ?? 0) < CITY_POPULATION_THRESHOLD) {
              return { text: "", show: false };
            }
          }

          // replace `/` with a line break
          name = name.replace(/\s*\/\s*/g, "\n");

          return {
            text: name,
            show: true,
            // Coarser admin levels win overlaps: country > region > county >
            // locality. POI names use confidence (< 1) so they always rank
            // below admin labels.
            declutterPriority: LABEL_TIERS.length - tierIndex,
          };
        },
        { filters: ["@name", "subtype", "local_type", "population"] },
      );
    };
    labelLayer.on("featureCreated", apply);
    labelLayer.on("featureUpdated", apply);
    // toggles.push({ title: labelTitle, layer: labelLayer });
  }

  // ---- Points of interest (places theme) -----------------------------------

  // A billboard carries one icon texture for the whole layer (the evaluator sets
  // `show`/`height` per feature, but not a per-feature icon). So rather than one
  // layer per category, we use ONE billboard layer and swap its icon + filter.
  const iconByKey = new Map<PoiKey, string>(
    POI_CATEGORIES.map(({ key, icon }) => [key, icon]),
  );

  // Active category (or "Off") plus a confidence floor — Overture tags a
  // `confidence` in [0,1] per place; raising the floor thins the dense icons.
  const poiState = {
    category: "Restaurants" as PoiKey | "Off",
    minConfidence: 0.99,
    // Fraction of matching places to keep (deterministic hash thinning). Low by
    // default so the street view stays legible and cheap; raise for completeness.
    density: 0.02,
  };

  // `sizeInMeters: false` keeps a constant screen size; `depthTest: false` keeps
  // the icon above buildings. `text` and `billboard` are independent materials on
  // ONE MVT layer, so each place draws both an icon and its name — no extra layer
  // or engine support needed.
  //
  // Positioning is anchor-only (`center`, a normalized Vec2), there is no pixel
  // offset. To read as `icon │ name` we anchor the icon's RIGHT edge and the
  // text's LEFT edge to the same geographic point, both vertically centered, so
  // the icon sits just left of the point and the name extends right from it.
  //
  // Only the NAME opts into decluttering. The icon and its own name touch at
  // the shared anchor, and the declutter pass can't know they belong to one
  // feature — enabling both would make the pair fight over the padding gap.
  // Icons are small and already density-thinned, so letting them overlap is
  // the standard map trade-off (MapLibre's `icon-allow-overlap` equivalent).
  const poiLayer = view.addLayer({
    type: "vector",
    source: placesSource,
    sourceLayers: ["place"],
    billboard: {
      url: iconByKey.get("Restaurants") ?? "",
      size: 30,
      sizeInMeters: false,
      clampToGround: false,
      center: { x: 0.5, y: 0.0 },
      depthTest: true,
      offsetDepth: true,
      transparent: true,
      alphaTest: 0.5,
    },
    text: {
      font: LABEL_FONT,
      color: new Color().setStyle("#1a1a1a"),
      size: 14,
      sizeInMeters: false,
      clampToGround: false,
      center: { x: 0.0, y: 0.0 },
      outlineColor: new Color().setStyle("#ffffff"),
      outlineWidth: 4,
      outlineOpacity: 0.6,
      depthTest: true,
      offsetDepth: true,
      highQuality: true,
      maxWidth: params.maxWidth,
      declutter: true,
    },
  });
  {
    const apply = ({ evaluator }: { evaluator: FeatureEvaluator }) => {
      evaluator.evaluate(
        ({ properties }) => {
          if (poiState.category === "Off") return { show: false };
          if (classifyPlace(properties) !== poiState.category)
            return { show: false };
          const confidence =
            (properties?.["confidence"] as number | undefined) ?? 0;
          if (confidence < poiState.minConfidence) return { show: false };

          // Density cap: keep only a stable hashed fraction so dense areas don't
          // flood the view. Key off the stable Overture `id` when present, else
          // a composite of properties (name+taxonomy+confidence) — either way the
          // same feature always hashes the same, so the kept set never flickers.
          const key =
            (properties?.["id"] as string | undefined) ??
            `${(properties?.["@name"] as string | undefined) ?? ""}|${
              (properties?.["taxonomy"] as string | undefined) ?? ""
            }|${confidence}`;
          if (hash01(key) >= poiState.density) return { show: false };

          // Names are gated tighter than icons: only the most confident
          // places get one (see POI_LABEL_MIN_CONFIDENCE); the declutter pass
          // handles the rest. Empty text → the icon draws with no label.
          // `@name` is Overture's computed primary name (same convention the
          // divisions labels use).
          let name =
            confidence >= POI_LABEL_MIN_CONFIDENCE
              ? ((properties?.["@name"] as string | undefined) ?? "")
              : "";

          // replace `/` with a line break
          name = name.replace(/\s*\/\s*/g, "\n");

          return {
            show: true,
            text: name,
            // Confidence in [0,1]: confident places win among POI names but
            // always rank below admin labels (tier priorities are >= 1). The
            // value also reaches the icon mesh, where it is inert (its
            // material has declutter off).
            declutterPriority: confidence,
          };
        },
        {
          filters: ["id", "@name", "taxonomy", "basic_category", "confidence"],
        },
      );
    };
    poiLayer.on("featureCreated", apply);
    poiLayer.on("featureUpdated", apply);
  }

  // Re-evaluate the POI layer (after a category/confidence change) and redraw.
  const restylePois = () => {
    poiLayer.forceUpdate();
    view.forceUpdate();
  };

  // Re-evaluate every layer and render. `forceUpdate` re-emits `featureUpdated`
  // for all loaded tiles, so a toggle flips visibility on existing geometry now.
  const restyle = () => {
    for (const { layer } of toggles) layer.forceUpdate();
    view.forceUpdate();
  };

  // ---- Control panel -------------------------------------------------------
  const pane = new Pane({ title: "Overture worldwide PMTiles" });

  const viewFolder = pane.addFolder({ title: "Viewpoints" });
  (Object.keys(VIEWPOINTS) as (keyof typeof VIEWPOINTS)[]).forEach((name) => {
    viewFolder.addButton({ title: name }).on("click", () => {
      view.setCamera({ ...VIEWPOINTS[name], heading: 0, roll: 0 });
    });
  });

  // Layer toggles — flipping a checkbox restyles every layer. Some titles map to
  // multiple layers (e.g. "Buildings"), so add one binding per distinct title.
  const layersFolder = pane.addFolder({ title: "Layers" });
  const boundToggleTitles = new Set<string>();
  for (const { title } of toggles) {
    if (boundToggleTitles.has(title)) continue;
    boundToggleTitles.add(title);
    layersFolder.addBinding(visible, title).on("change", () => {
      restyle();
    });
  }

  layersFolder
    .addBinding(params, "size", {
      min: 10,
      max: 100,
      step: 1,
      label: "label size",
    })
    .on("change", ({ value }) => {
      labelLayer.update({ text: { size: value } });
      view.forceUpdate();
    });

  layersFolder
    .addBinding(params, "maxWidth", {
      min: 0,
      max: 20,
      step: 0.5,
      label: "label max width",
    })
    .on("change", ({ value }) => {
      labelLayer.update({ text: { maxWidth: value } });
      poiLayer.update({ text: { maxWidth: value } });
      view.forceUpdate();
    });

  // POI controls: pick a category (swaps icon + filter) and a confidence floor.
  const poiFolder = pane.addFolder({ title: "Places (POIs)" });
  poiFolder
    .addBinding(poiState, "category", {
      label: "category",
      options: {
        Off: "Off",
        ...Object.fromEntries(POI_CATEGORIES.map(({ key }) => [key, key])),
      },
    })
    .on("change", ({ value }) => {
      const icon = value !== "Off" ? iconByKey.get(value as PoiKey) : undefined;
      if (icon) poiLayer.update({ billboard: { url: icon } });
      restylePois();
    });
  poiFolder
    .addBinding(poiState, "minConfidence", {
      min: 0,
      max: 1,
      step: 0.01,
      label: "min confidence",
    })
    .on("change", () => {
      restylePois();
    });
  poiFolder
    .addBinding(poiState, "density", {
      min: 0,
      max: 1,
      step: 0.01,
      label: "max density",
    })
    .on("change", () => {
      restylePois();
    });

  // All four Overture sources are declared; base/divisions/buildings share one
  // credit, so the AttributionPlugin collapses them to a single rendered line.
  attribution?.add([
    PMTILES_DATASETS.overtureBase,
    PMTILES_DATASETS.overtureDivisions,
    PMTILES_DATASETS.overtureBuildings,
    PMTILES_DATASETS.overturePlaces,
  ]);
};
