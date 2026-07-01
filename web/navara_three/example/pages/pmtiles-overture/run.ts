import ThreeView, {
  Color,
  type FeatureEvaluator,
  type Layer,
} from "@navara/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";
import { AttributionPlugin } from "@navara/three_plugins";
import { SphericalHarmonics3 } from "three";
import { Pane } from "tweakpane";

import { datasetToSource } from "../../helpers/attribution-source";
import { PMTILES_DATASETS } from "../../helpers/constants";
import { SH_COEFFICIENTS } from "../../helpers/sh";

import LABEL_FONT_FAMILY from "./labelFontFamily.json";

export type CustomDescriptions = DefaultDescriptions;

// Family name the faces are registered under (see labelFontFamily.json).
const LABEL_FONT = "OvertureLabels";

// Camera presets.
const VIEWPOINTS = {
  World: { lng: 10, lat: 25, height: 22_000_000, pitch: -90 },
  Europe: { lng: 12, lat: 48, height: 4_500_000, pitch: -90 },
  "East Asia": { lng: 121, lat: 33, height: 5_000_000, pitch: -90 },
  Americas: { lng: -95, lat: 35, height: 8_000_000, pitch: -90 },
  "Tokyo (street)": { lng: 139.767, lat: 35.679, height: 1_000, pitch: -35 },
} as const;

const LABEL_TIERS = [
  {
    key: "country",
    maxHeight: 4_000_000,
    match: ["country"],
  },
  {
    key: "region",
    maxHeight: 2_000_000,
    match: ["region", "macroregion", "governorate", "province", "state"],
  },
  {
    key: "county",
    maxHeight: 800_000,
    match: ["county", "macrocounty", "localadmin", "district"],
  },
  {
    key: "locality",
    maxHeight: 100_000,
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

// Place names are far more numerous and glyph-diverse than admin labels, so the
// text is gated harder than the icons: a place gets a label only when the camera
// is below `POI_LABEL_MAX_HEIGHT` and the place's `confidence` clears a higher
// floor than the icon needs. This keeps dense cities readable and bounds how
// many distinct strings the text shaper handles at once. Icons are unaffected.
const POI_LABEL_MAX_HEIGHT = 5_000; // 5 km
const POI_LABEL_MIN_CONFIDENCE = 0.9;

// Deterministic [0,1] hash (FNV-1a) of a string. The engine has no label
// collision/declutter system and the evaluator sees no geometry, so dense areas
// (e.g. Tokyo street level) can't be grid-thinned spatially. Instead we hash a
// stable per-feature key and keep only points below a density threshold: this
// caps how many icon/label pairs render, is stable across re-evaluation (so
// nothing flickers on pan/zoom), and thins roughly uniformly across space.
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

  const attribution = new AttributionPlugin();
  view.addPlugin(attribution);

  await view.init();

  view.addFontFamily(LABEL_FONT_FAMILY);

  view.addLight({ ambient: {} });
  view.addLight({
    lightProbe: {
      sh: new SphericalHarmonics3().set(SH_COEFFICIENTS.white),
      intensity: 1,
    },
  });

  view.setCamera({ ...VIEWPOINTS.World, heading: 0, roll: 0 });

  view.addLayer({ type: "terrain", ellipsoid: {} });

  const baseUrl = PMTILES_DATASETS.overtureBase.url;
  const divisionsUrl = PMTILES_DATASETS.overtureDivisions.url;

  // Visibility is driven per-feature via each layer's evaluator, not the
  // material's `show` (which only seeds future features). The evaluator restyles
  // already-batched geometry, so toggling affects what's already on screen.
  const visible: Record<string, boolean> = {};

  // Every layer reusing the same URL resolves through a single PmtilesSource;
  // `vectorTile.layers` selects which MVT sublayer each one styles.
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
      type: "mvt",
      data: { url: baseUrl },
      polygon: {
        color: new Color().setStyle(color),
        clampToGround: true,
      },
      vectorTile: { maxZoom: 13, layers: [source] },
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
    type: "mvt",
    data: { url: divisionsUrl },
    polyline: {
      color: new Color().setStyle("#757575"), // division.boundary gray.700
      width: 1.5,
      height: 1,
      clampToGround: true,
    },
    vectorTile: { maxZoom: 12, layers: ["division_boundary"] },
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
    type: "mvt",
    data: { url: PMTILES_DATASETS.overtureBuildings.url },
    polygon: {
      color: buildingColor,
      // Seeds the attribute slots; the evaluator overrides height per feature.
      height: 0,
      extrudedHeight: 0,
      clampToGround: false,
    },
    vectorTile: { maxZoom: 14, layers: ["building"] },
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
    type: "mvt",
    data: { url: PMTILES_DATASETS.overtureBuildings.url },
    polygon: {
      color: buildingColor,
      height: 0,
      extrudedHeight: 0,
      clampToGround: false,
    },
    vectorTile: { maxZoom: 14, layers: ["building_part"] },
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
  // registered font family resolves the correct face per glyph.
  const labelTitle = "Labels";
  visible[labelTitle] = true;
  const params = { size: 20 };

  // The evaluator reads this closure variable to decide which tiers are visible;
  // kept in sync with the camera below. Seed it from the initial viewpoint, not
  // `view.camera.positionGeographic` — that getter throws before the first frame.
  let currentHeight: number = VIEWPOINTS.World.height;

  const labelLayer = view.addLayer({
    type: "mvt",
    data: { url: divisionsUrl },
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
    },
    // Finer admin features (governorate/district) exist only in higher-zoom
    // tiles, so fetch to z12 and let the altitude tiers keep the view uncluttered.
    vectorTile: { maxZoom: 12, layers: ["division"] },
  });

  {
    const apply = ({ evaluator }: { evaluator: FeatureEvaluator }) => {
      evaluator.evaluate(
        ({ properties }) => {
          if (!visible[labelTitle]) return { show: false };

          const name = properties?.["@name"] as string | undefined;
          if (!name) return { text: "", show: false };

          // Assign an altitude tier: prefer locale-specific `local_type`, fall
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

          // Hidden until the camera descends to this tier's altitude band.
          if (currentHeight > tier.maxHeight) return { text: "", show: false };

          // Within the locality tier, still keep only the largest cities.
          if (tier.key === "locality") {
            const population = properties?.["population"] as number | undefined;
            if ((population ?? 0) < CITY_POPULATION_THRESHOLD) {
              return { text: "", show: false };
            }
          }

          return { text: name, show: true };
        },
        { filters: ["@name", "subtype", "local_type", "population"] },
      );
    };
    labelLayer.on("featureCreated", apply);
    labelLayer.on("featureUpdated", apply);
    // toggles.push({ title: labelTitle, layer: labelLayer });
  }

  // ---- Points of interest (places theme) -----------------------------------
  const placesUrl = PMTILES_DATASETS.overturePlaces.url;

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
  const poiLayer = view.addLayer({
    type: "mvt",
    data: { url: placesUrl },
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
    },
    vectorTile: { maxZoom: 14, layers: ["place"] },
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

          // Names are gated tighter than icons (see POI_LABEL_* above): only the
          // most confident places, and only when zoomed in. Empty text → the
          // icon draws with no label. `@name` is Overture's computed primary
          // name (same convention the divisions labels use).
          const labelable =
            currentHeight <= POI_LABEL_MAX_HEIGHT &&
            confidence >= POI_LABEL_MIN_CONFIDENCE;
          const name = labelable
            ? ((properties?.["@name"] as string | undefined) ?? "")
            : "";
          return { show: true, text: name };
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

  // Drive label visibility from altitude. The visible tier set only changes when
  // `currentHeight` crosses a `maxHeight`, so encode it as a "band key" and
  // restyle only on change — `move` fires every frame and would thrash the batcher.
  const bandKeyAt = (height: number) =>
    LABEL_TIERS.map((tier) => (height <= tier.maxHeight ? "1" : "0")).join("");
  let lastBandKey = bandKeyAt(currentHeight);
  // POI names appear only below `POI_LABEL_MAX_HEIGHT`; track that band crossing
  // separately so we re-evaluate the POI layer when it flips (its threshold need
  // not line up with any `LABEL_TIERS` boundary).
  let poiLabelsVisible = currentHeight <= POI_LABEL_MAX_HEIGHT;
  // The `move` handler (readout + tier restyle) is registered at the end, once
  // the control panel exists.

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

  // Live-tunable altitude thresholds (km). Changing one re-evaluates the labels
  // against the current camera height.
  const tiersFolder = pane.addFolder({ title: "Label altitude (km)" });
  for (const tier of LABEL_TIERS) {
    const proxy = { km: Math.round(tier.maxHeight / 1000) };
    tiersFolder
      .addBinding(proxy, "km", {
        min: 100,
        max: 20_000,
        step: 100,
        label: tier.key,
      })
      .on("change", ({ value }) => {
        tier.maxHeight = value * 1000;
        lastBandKey = bandKeyAt(currentHeight);
        labelLayer.forceUpdate();
        view.forceUpdate();
      });
  }

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

  // Read-only altitude readout. A `readonly` string binding renders as a text
  // monitor; we mutate `readout.altitude` and `.refresh()` it from the handler.
  const readout = { altitude: `${(currentHeight / 1000).toFixed(0)} km` };
  const altitudeMonitor = pane.addBinding(readout, "altitude", {
    readonly: true,
    label: "Camera Altitude",
  });

  // Update the readout every move; restyle labels only when crossing a tier.
  view.camera.on("move", () => {
    // `positionGeographic` throws before the core's camera status is ready; skip.
    let height: number;
    try {
      height = view.camera.positionGeographic.height;
    } catch {
      return;
    }
    currentHeight = height;

    readout.altitude = `${(currentHeight / 1000).toFixed(0)} km`;
    altitudeMonitor.refresh();

    // POI name gate: re-evaluate the POI layer only when crossing its altitude
    // threshold (checked before the admin-label early-return below, since the
    // two band boundaries are independent).
    const poiVisibleNow = currentHeight <= POI_LABEL_MAX_HEIGHT;
    if (poiVisibleNow !== poiLabelsVisible) {
      poiLabelsVisible = poiVisibleNow;
      poiLayer.forceUpdate();
      view.forceUpdate();
    }

    const bandKey = bandKeyAt(currentHeight);
    if (bandKey === lastBandKey) return;
    lastBandKey = bandKey;
    // Re-run the label evaluator against the new altitude and redraw.
    labelLayer.forceUpdate();
    view.forceUpdate();
  });

  attribution.show([
    datasetToSource(PMTILES_DATASETS.overtureBase),
    datasetToSource(PMTILES_DATASETS.overtureDivisions),
    datasetToSource(PMTILES_DATASETS.overtureBuildings),
    datasetToSource(PMTILES_DATASETS.overturePlaces),
  ]);
};
