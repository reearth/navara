import ThreeView, {
  Color,
  type FontFamily,
} from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import { Pane } from "tweakpane";

import { showAttributions } from "../../../helpers/attributions";
import {
  FONT_DATASETS,
  GEOJSON_DATASETS,
  TILE_DATASETS,
} from "../../../helpers/constants";
import { addDateControl } from "../../../helpers/control";

/**
 * Font family definition with multiple faces covering different unicode ranges.
 * Each face points to a font file that covers a specific script.
 * Only the font file matching the text's characters will be loaded.
 *
 * Uses the full Roboto variable font for Latin/Cyrillic/Greek (all glyphs in one file)
 * and Noto Sans script-specific subsets for CJK, Arabic, and other scripts.
 */
const face = (url: string, unicodeRanges: { from: number; to: number }[]) => ({
  family: "WorldCities",
  style: "normal",
  weight: 400,
  url,
  unicodeRanges,
});

const WORLD_FONT_FAMILY: FontFamily = {
  family: "WorldCities",
  faces: [
    // Roboto (covers Latin, Latin-ext, Cyrillic, Greek, Vietnamese in one file)
    face(FONT_DATASETS.Roboto.url, [
      { from: 0x0000, to: 0x02ff }, // Latin + Latin Extended
      { from: 0x0370, to: 0x03ff }, // Greek
      { from: 0x0400, to: 0x052f }, // Cyrillic + Cyrillic Extended
      { from: 0x1e00, to: 0x1eff }, // Latin Extended Additional
      { from: 0x2000, to: 0x206f }, // General Punctuation
      { from: 0x20ac, to: 0x20ac }, // Euro sign
    ]),
    // Japanese (CJK + Kana)
    face(FONT_DATASETS.NotoSansJP.url, [
      { from: 0x3040, to: 0x30ff }, // Hiragana + Katakana
      { from: 0x4e00, to: 0x9fff }, // CJK Unified Ideographs
    ]),
    // Simplified Chinese
    face(FONT_DATASETS.NotoSansSC.url, [
      { from: 0x4e00, to: 0x9fff }, // CJK Unified Ideographs
    ]),
    // Korean (Hangul)
    face(FONT_DATASETS.NotoSansKR.url, [
      { from: 0xac00, to: 0xd7af }, // Hangul Syllables
      { from: 0x1100, to: 0x11ff }, // Hangul Jamo
    ]),
    // Arabic
    face(FONT_DATASETS.NotoSansArabic.url, [
      { from: 0x0600, to: 0x06ff }, // Arabic
      { from: 0x0750, to: 0x077f }, // Arabic Supplement
      { from: 0xfb50, to: 0xfdff }, // Arabic Presentation Forms-A
      { from: 0xfe70, to: 0xfeff }, // Arabic Presentation Forms-B
    ]),
    // Thai
    face(FONT_DATASETS.NotoSansThai.url, [{ from: 0x0e00, to: 0x0e7f }]),
    // Devanagari (Hindi)
    face(FONT_DATASETS.NotoSansDevanagari.url, [
      { from: 0x0900, to: 0x097f },
    ]),
    // Hebrew
    face(FONT_DATASETS.NotoSansHebrew.url, [{ from: 0x0590, to: 0x05ff }]),
    // Georgian
    face(FONT_DATASETS.NotoSansGeorgian.url, [{ from: 0x10a0, to: 0x10ff }]),
    // Bengali
    face(FONT_DATASETS.NotoSansBengali.url, [{ from: 0x0980, to: 0x09ff }]),
    // Tamil
    face(FONT_DATASETS.NotoSansTamil.url, [{ from: 0x0b80, to: 0x0bff }]),
    // Telugu
    face(FONT_DATASETS.NotoSansTelugu.url, [{ from: 0x0c00, to: 0x0c7f }]),
    // Kannada
    face(FONT_DATASETS.NotoSansKannada.url, [{ from: 0x0c80, to: 0x0cff }]),
    // Armenian
    face(FONT_DATASETS.NotoSansArmenian.url, [{ from: 0x0530, to: 0x058f }]),
    // Myanmar
    face(FONT_DATASETS.NotoSansMyanmar.url, [{ from: 0x1000, to: 0x109f }]),
    // Lao
    face(FONT_DATASETS.NotoSansLao.url, [{ from: 0x0e80, to: 0x0eff }]),
  ],
};

const run = async () => {
  const view = new ThreeView({
    debug: true,
  });

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  await view.init();

  defaultPlugin.addDefaultPhotorealLayers();

  // Register the multi-script font family
  view.addFontFamily(WORLD_FONT_FAMILY);

  // Global view: show all cities
  view.setCamera({
    lng: 30,
    lat: 20,
    height: 20_000_000,
    heading: 0,
    pitch: -90,
    roll: 0,
  });

  // Base tiles
  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: { maxZoom: 19 },
  });

  // Track updated features to prevent duplicate evaluations
  let updatedFeatures = new Set<bigint>();

  const params = { size: 20 };

  // GeoJSON text layer with font faces: city names in native scripts
  const addCityLayer = () => {
    updatedFeatures = new Set<bigint>();

    const layer = view.addLayer({
      type: "geojson",
      data: { url: GEOJSON_DATASETS.worldCities.url },
      text: {
        font: "WorldCities", // Uses the registered font family name
        color: new Color().setStyle("#ffffff"),
        size: params.size,
        sizeInMeters: false,
        clampToGround: true,
        depthTest: true,
        center: { x: 0.5, y: 0.0 },
        // outlineColor: new Color().setStyle("#000000"),
        // outlineWidth: 5,
        // outlineOpacity: 1.0,
      },
    });

    layer.on("featureUpdated", ({ evaluator }) => {
      if (updatedFeatures.has(evaluator.id)) return;
      updatedFeatures.add(evaluator.id);

      evaluator.evaluate(
        ({ properties }) => {
          const name = properties?.["name"] as string | undefined;
          return {
            text: name ?? "",
            show: !!name,
          };
        },
        { filters: ["name"] },
      );
    });

    return layer;
  };

  let layer = addCityLayer();

  // Control panel
  const pane = new Pane({ title: "GeoJSON Font Faces" });
  addDateControl(view, pane);

  const toggleBtn = pane.addButton({ title: "Remove Layer", label: "layer" });
  toggleBtn.on("click", () => {
    if (layer) {
      view.deleteLayerById(layer.id);
      layer = undefined as unknown as typeof layer;
      toggleBtn.title = "Add Layer";
    } else {
      layer = addCityLayer();
      toggleBtn.title = "Remove Layer";
    }
  });

  pane
    .addBinding(params, "size", { min: 10, max: 60, step: 1 })
    .on("change", ({ value }) => {
      layer?.update({ text: { size: value } });
    });

  showAttributions([
    TILE_DATASETS.openstreetmap,
    FONT_DATASETS.Roboto,
    FONT_DATASETS.NotoSansJP,
    FONT_DATASETS.NotoSansArabic,
  ]);
};

run();
