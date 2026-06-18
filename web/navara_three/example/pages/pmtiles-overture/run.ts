import ThreeView, {
  Color,
  type FeatureEvaluator,
  type Layer,
} from "@navara/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";
import { SphericalHarmonics3 } from "three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import { PMTILES_DATASETS } from "../../helpers/constants";
import { SH_COEFFICIENTS } from "../../helpers/sh";

// A multi-script font family: each face declares the `unicodeRanges` it covers,
// and the font pipeline picks the first face whose range contains each glyph —
// so a single text layer can label names in any script without manual routing.
//
// The labels are bold and wide: Latin/Vietnamese use Archivo at ExtraBold
// (wght 800) and the widest width (wdth 125); every other script uses Noto at
// the heaviest weight Google Fonts offers it.
//
// Precedence (first match wins): Archivo gives the bold/wide Latin look and the
// fallback (face 0); a "Noto Sans" face backstops Cyrillic/Greek plus any Latin
// glyphs Archivo omits (e.g. U+02BB in "Oʻzbekiston", U+1E37 in "Ṃajeḷ"); then
// per-script Noto faces (Arabic, Hebrew, Thaana, the Indic family,
// Thai/Lao/Khmer/Myanmar, Georgian, Armenian, Ethiopic, Tibetan, Mongolian,
// Tifinagh, …); then full CJK (Noto Sans JP/SC/KR).
//
// Each face's ranges are built from the font's ACTUAL cmap, not the CSS
// `unicode-range` — because the segmenter has no glyph-existence fallback, a
// face that claimed a glyph it lacks (a font subset, or the shared CJK slice
// partition where SC advertises Hangul it doesn't ship) would tofu instead of
// deferring to the next face. Faces load lazily, so the long list is cheap.
//
// Regenerate (from repo root): python3 \
//   web/navara_three/example/pages/pmtiles-overture/gen_label_font_family.py \
//   web/navara_three/example/pages/pmtiles-overture/labelFontFamily.json
import LABEL_FONT_FAMILY from "./labelFontFamily.json";

export type CustomDescriptions = DefaultDescriptions;

// The family name the faces are registered under (see labelFontFamily.json).
const LABEL_FONT = "OvertureLabels";

// Camera presets for exploring the worldwide archive.
const VIEWPOINTS = {
  World: { lng: 10, lat: 25, height: 22_000_000, pitch: -90 },
  Europe: { lng: 12, lat: 48, height: 4_500_000, pitch: -90 },
  "East Asia": { lng: 121, lat: 33, height: 5_000_000, pitch: -90 },
  Americas: { lng: -95, lat: 35, height: 8_000_000, pitch: -90 },
} as const;

// Overture's `division` layer carries far too many features to label all of
// them on a global view, so we keep administrative areas (countries / regions)
// plus only the largest localities. `subtype` and `population` come straight
// from the Overture schema.
const LABELLED_SUBTYPES = new Set(["country"]);
const CITY_POPULATION_THRESHOLD = 1_000_000;

// Polygon fills from the `base` theme, drawn back-to-front. `land` is the base
// fill; everything else drapes on top of it. Colors mirror the Overture Maps
// Explorer palette (its `sand`/`ocean`/`green` design tokens, converted from
// HSL to hex) so this page reads the same as explore.overturemaps.org.
const BASE_POLYGONS = [
  { title: "Land", source: "land", color: "#f8f4f1" }, // sand.50
  { title: "Land cover", source: "land_cover", color: "#c4eaa9" }, // grass fallback
  { title: "Land use", source: "land_use", color: "#d6ecd5" }, // park green.200
  { title: "Water", source: "water", color: "#79cdf6" }, // ocean.900
] as const;

// `land_cover` features carry a `subtype` (the dominant ground material, from
// Overture's `LandCoverSubtype` enum). Instead of one flat fill we color each
// feature by its category. Any subtype not listed falls back to the layer's
// material color. Values are Overture's per-subtype semantic tokens.
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

export const run = async (view: ThreeView<CustomDescriptions>) => {
  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  await view.init();

  // defaultPlugin.addDefaultPhotorealScene();

  view.addFontFamily(LABEL_FONT_FAMILY);

  view.addLight({ ambient: {} });
  // view.toneMappingExposure = 3;
  // view.addEffect({ toneMapping: { mode: ToneMappingMode.REINHARD2 } });
  // view.addEffect({ smaa: {} });
  view.addLight({
    lightProbe: {
      sh: new SphericalHarmonics3().set(SH_COEFFICIENTS.white),
      intensity: 1,
    },
  });

  view.setCamera({ ...VIEWPOINTS.World, heading: 0, roll: 0 });

  // A plain ellipsoid surface to drape the clamp-to-ground vectors onto (this
  // example has no terrain/raster base of its own).
  view.addLayer({ type: "terrain", ellipsoid: {} });

  const baseUrl = PMTILES_DATASETS.overtureBase.url;
  const divisionsUrl = PMTILES_DATASETS.overtureDivisions.url;

  // Visibility is driven per-feature through each layer's evaluator rather than
  // the material's `show`. A material-level `show` only seeds features created
  // afterward, whereas the evaluator sets `show` on already-batched tile
  // geometry — so toggling re-styles what's already on screen.
  const visible: Record<string, boolean> = {};

  // The `vectorTile.layers` filter selects which MVT layer inside the shared
  // archive each Navara layer styles (same mechanism as the MVT example). Every
  // layer reusing the same URL resolves through a single PmtilesSource.
  const toggles: { title: string; layer: Layer }[] = [];

  // Precompute the per-subtype Color instances once and reuse them across
  // features (the evaluator runs per feature, per tile).
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

    // Apply the current visibility to each feature set, both on initial load
    // and on every forced re-style (toggle). `land_cover` additionally colors
    // each feature by its `subtype`.
    const apply = ({ evaluator }: { evaluator: FeatureEvaluator }) => {
      if (source === "land_cover") {
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

  // A single text layer for labels in every script. Overture stores the
  // localized primary name under the `@name` property; the registered font
  // family resolves the correct face per glyph.
  const labelTitle = "Labels";
  visible[labelTitle] = true;
  const params = { size: 16 };

  const labelLayer = view.addLayer({
    type: "mvt",
    data: { url: divisionsUrl },
    text: {
      font: LABEL_FONT,
      color: new Color().setStyle("#000000"),
      size: params.size,
      sizeInMeters: false,
      clampToGround: true,
      center: { x: 0.5, y: 0.5 },
      outlineColor: new Color().setStyle("#ffffff"),
      outlineWidth: 5,
      outlineOpacity: 0.4,
      offsetDepth: true,
      depthTest: true,
    },
    vectorTile: { maxZoom: 1, layers: ["division"] },
  });

  {
    const apply = ({ evaluator }: { evaluator: FeatureEvaluator }) => {
      evaluator.evaluate(
        ({ properties }) => {
          if (!visible[labelTitle]) return { show: false };

          const name = properties?.["@name"] as string | undefined;
          if (!name) return { text: "", show: false };

          // Declutter: administrative areas plus only the largest cities.
          const subtype = properties?.["subtype"] as string | undefined;
          const population = properties?.["population"] as number | undefined;
          const isAdminArea = subtype ? LABELLED_SUBTYPES.has(subtype) : false;
          const isMajorCity =
            subtype === "locality" &&
            (population ?? 0) >= CITY_POPULATION_THRESHOLD;
          if (!isAdminArea && !isMajorCity) {
            return { text: "", show: false };
          }

          return { text: name, show: true };
        },
        { filters: ["@name", "subtype", "population"] },
      );
    };
    labelLayer.on("featureCreated", apply);
    labelLayer.on("featureUpdated", apply);
    // toggles.push({ title: labelTitle, layer: labelLayer });
  }

  // Re-evaluate every layer and request a render. `forceUpdate` re-emits
  // `featureUpdated` for all loaded tiles, so a toggle flips visibility on
  // existing geometry immediately rather than only on the next data load.
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

  // Layer toggles — flipping any checkbox re-styles every layer immediately.
  const layersFolder = pane.addFolder({ title: "Layers" });
  for (const { title } of toggles) {
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

  showAttributions([
    PMTILES_DATASETS.overtureBase,
    PMTILES_DATASETS.overtureDivisions,
  ]);
};
