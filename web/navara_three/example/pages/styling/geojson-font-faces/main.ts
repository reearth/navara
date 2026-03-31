import ThreeView, { Color, type FontFamily } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import { Pane } from "tweakpane";

import { showAttributions } from "../../../helpers/attributions";
import {
  FONT_DATASETS,
  GEOJSON_DATASETS,
  TERRAIN_DATASETS,
  TILE_DATASETS,
} from "../../../helpers/constants";
import { addDateControl } from "../../../helpers/control";

import {
  notoSansJPSlices,
  notoSansSCSlices,
  notoSansKRSlices,
} from "./cjkSlices";

/**
 * Font family definition with multiple faces covering different unicode ranges.
 * Each face points to a small WOFF2 file that covers a specific script.
 * Only the font file matching the text's characters will be loaded.
 */
const WORLD_FONT_FAMILY: FontFamily = {
  family: "WorldCities",
  faces: [
    // Latin (Basic Latin + Latin-1 Supplement + common punctuation/symbols)
    {
      url: FONT_DATASETS.RobotoLatin.url,
      unicodeRanges: [
        { from: 0x0000, to: 0x00ff },
        { from: 0x0131, to: 0x0131 },
        { from: 0x0152, to: 0x0153 },
        { from: 0x02bb, to: 0x02bc },
        { from: 0x02c6, to: 0x02c6 },
        { from: 0x02da, to: 0x02da },
        { from: 0x02dc, to: 0x02dc },
        { from: 0x2000, to: 0x206f },
        { from: 0x20ac, to: 0x20ac },
        { from: 0x2122, to: 0x2122 },
        { from: 0xfeff, to: 0xfeff },
        { from: 0xfffd, to: 0xfffd },
      ],
    },
    // Latin Extended
    {
      url: FONT_DATASETS.RobotoLatinExt.url,
      unicodeRanges: [
        { from: 0x0100, to: 0x02ba },
        { from: 0x02bd, to: 0x02c5 },
        { from: 0x02c7, to: 0x02cc },
        { from: 0x02ce, to: 0x02d7 },
        { from: 0x02dd, to: 0x02ff },
        { from: 0x1d00, to: 0x1dbf },
        { from: 0x1e00, to: 0x1e9f },
        { from: 0x1ef2, to: 0x1eff },
        { from: 0x2020, to: 0x2020 },
        { from: 0x20a0, to: 0x20ab },
        { from: 0x20ad, to: 0x20c0 },
        { from: 0x2c60, to: 0x2c7f },
        { from: 0xa720, to: 0xa7ff },
      ],
    },
    // Cyrillic
    {
      url: FONT_DATASETS.RobotoCyrillic.url,
      unicodeRanges: [
        { from: 0x0301, to: 0x0301 },
        { from: 0x0400, to: 0x045f },
        { from: 0x0490, to: 0x0491 },
        { from: 0x04b0, to: 0x04b1 },
        { from: 0x2116, to: 0x2116 },
      ],
    },
    // Cyrillic Extended
    {
      url: FONT_DATASETS.RobotoCyrillicExt.url,
      unicodeRanges: [
        { from: 0x0460, to: 0x052f },
        { from: 0x1c80, to: 0x1c8a },
        { from: 0x20b4, to: 0x20b4 },
        { from: 0x2de0, to: 0x2dff },
        { from: 0xa640, to: 0xa69f },
        { from: 0xfe2e, to: 0xfe2f },
      ],
    },
    // Greek
    {
      url: FONT_DATASETS.RobotoGreek.url,
      unicodeRanges: [
        { from: 0x0370, to: 0x0377 },
        { from: 0x037a, to: 0x037f },
        { from: 0x0384, to: 0x038a },
        { from: 0x038c, to: 0x038c },
        { from: 0x038e, to: 0x03a1 },
        { from: 0x03a3, to: 0x03ff },
      ],
    },
    // Vietnamese
    {
      url: FONT_DATASETS.RobotoVietnamese.url,
      unicodeRanges: [
        { from: 0x0102, to: 0x0103 },
        { from: 0x0110, to: 0x0111 },
        { from: 0x0128, to: 0x0129 },
        { from: 0x0168, to: 0x0169 },
        { from: 0x01a0, to: 0x01a1 },
        { from: 0x01af, to: 0x01b0 },
        { from: 0x0300, to: 0x0301 },
        { from: 0x0303, to: 0x0304 },
        { from: 0x0308, to: 0x0309 },
        { from: 0x0323, to: 0x0323 },
        { from: 0x0329, to: 0x0329 },
        { from: 0x1ea0, to: 0x1ef9 },
        { from: 0x20ab, to: 0x20ab },
      ],
    },
    // ---------------------------------------------------------------
    // Noto Sans JP slices (Google Fonts woff2 subsets for Japanese)
    // Each slice covers specific CJK codepoints used in city names.
    // ---------------------------------------------------------------
    ...notoSansJPSlices,
    // ---------------------------------------------------------------
    // Noto Sans SC slices (Google Fonts woff2 subsets for Simplified Chinese)
    // ---------------------------------------------------------------
    ...notoSansSCSlices,
    // ---------------------------------------------------------------
    // Noto Sans KR slices (Google Fonts woff2 subsets for Korean)
    // ---------------------------------------------------------------
    ...notoSansKRSlices,
    // Arabic
    {
      url: FONT_DATASETS.NotoSansArabic.url,
      unicodeRanges: [
        { from: 0x0600, to: 0x06ff }, // Arabic
        { from: 0x0750, to: 0x077f }, // Arabic Supplement
        { from: 0x08a0, to: 0x08ff }, // Arabic Extended-A
        { from: 0xfb50, to: 0xfdff }, // Arabic Presentation Forms-A
        { from: 0xfe70, to: 0xfeff }, // Arabic Presentation Forms-B
      ],
    },
    // Thai
    {
      url: FONT_DATASETS.NotoSansThai.url,
      unicodeRanges: [{ from: 0x0e00, to: 0x0e7f }],
    },
    // Devanagari (Hindi, Nepali)
    {
      url: FONT_DATASETS.NotoSansDevanagari.url,
      unicodeRanges: [
        { from: 0x0900, to: 0x097f }, // Devanagari
        { from: 0xa8e0, to: 0xa8ff }, // Devanagari Extended
      ],
    },
    // Armenian
    {
      url: FONT_DATASETS.NotoSansArmenian.url,
      unicodeRanges: [{ from: 0x0530, to: 0x058f }],
    },
    // Georgian
    {
      url: FONT_DATASETS.NotoSansGeorgian.url,
      unicodeRanges: [{ from: 0x10a0, to: 0x10ff }],
    },
    // Bengali
    {
      url: FONT_DATASETS.NotoSansBengali.url,
      unicodeRanges: [{ from: 0x0980, to: 0x09ff }],
    },
    // Tamil
    {
      url: FONT_DATASETS.NotoSansTamil.url,
      unicodeRanges: [{ from: 0x0b80, to: 0x0bff }],
    },
    // Telugu
    {
      url: FONT_DATASETS.NotoSansTelugu.url,
      unicodeRanges: [{ from: 0x0c00, to: 0x0c7f }],
    },
    // Kannada
    {
      url: FONT_DATASETS.NotoSansKannada.url,
      unicodeRanges: [{ from: 0x0c80, to: 0x0cff }],
    },
    // Myanmar
    {
      url: FONT_DATASETS.NotoSansMyanmar.url,
      unicodeRanges: [{ from: 0x1000, to: 0x109f }],
    },
    // Lao
    {
      url: FONT_DATASETS.NotoSansLao.url,
      unicodeRanges: [{ from: 0x0e80, to: 0x0eff }],
    },
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
        outlineColor: new Color().setStyle("#000000"),
        outlineWidth: 5,
        outlineOpacity: 0.5,
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
    TERRAIN_DATASETS.mapterhorn,
    FONT_DATASETS.RobotoLatin,
    FONT_DATASETS.NotoSansJP,
  ]);
};

run();
