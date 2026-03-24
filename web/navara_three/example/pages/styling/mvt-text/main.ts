import ThreeView, { Color, JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import { Pane } from "tweakpane";

import { showAttributions } from "../../../helpers/attributions";
import {
  TERRAIN_DATASETS,
  TILE_DATASETS,
  VECTOR_DATASETS,
  FONT_DATASETS,
} from "../../../helpers/constants";
import { addDateControl } from "../../../helpers/control";

// Allowed feature codes (from GSI vector tile spec)
// Ref: https://maps.gsi.go.jp/help/pdf/vector/dataspec.pdf
const ALLOWED_FT_CODE = [
  51301, // Population 1M+
  51302, // Population 500K-1M
  51303, // Population <500K
  1401, // Prefectural capital
  1402, // City hall / Tokyo ward office
  1403, // Town/village office / Designated city ward office
  100, // Prefectural government
  3205, // City hall / Tokyo ward office
  3206, // Town/village office / Designated city ward office
  6321, // Broadleaf forest
  6322, // Coniferous forest
  6331, // Hot spring
];

const ALLOWED_ANNO_CTG = [
  110, // Municipality
  311, // Mountain name
  621, // Prefectural government
  661, // Shrine
];

const run = async () => {
  const view = new ThreeView({
    debug: true,
  });

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  await view.init();

  defaultPlugin.addDefaultPhotorealLayers();

  // Camera position for Japan overview
  view.setCamera({
    lng: 139.0,
    lat: 36.0,
    height: 100000,
    heading: 0,
    pitch: -45,
    roll: 0,
  });

  // Base tiles layer
  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: { maxZoom: 19 },
  });
  view.addLayer({
    type: "terrain",
    data: {
      url: TERRAIN_DATASETS.gsi.url,
    },
    rasterTerrain: {
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
      maxZoom: 15,
      castShadow: true,
      receiveShadow: true,
    },
  });

  // Track updated features to prevent duplicate evaluations
  let updatedFeatures = new Set<bigint>();

  const params = { size: 20 };

  // MVT text layer: Symbols from GSI vector tiles
  const addMvtLayer = () => {
    updatedFeatures = new Set<bigint>();

    const layer = view.addLayer({
      type: "mvt",
      data: { url: VECTOR_DATASETS.gsiExperimentalVector.url },
      text: {
        lang: "ja",
        font: FONT_DATASETS.LineSeedJP.url,
        color: new Color().setStyle("#ffffff"),
        scaleByDistance: true,
        clampToGround: true,
        size: params.size,
        outlineColor: new Color().setStyle("#000000"),
        outlineWidth: 2,
        center: { x: 0.5, y: 0.0 },
        outlineColor: new Color().setStyle("#000000"),
        outlineWidth: 2,
      },
      vectorTile: {
        maxZoom: 16,
        layers: ["symbol", "label"],
      },
    });

    // Feature evaluator: filter and style text labels
    layer.on("featureUpdated", ({ evaluator }) => {
      if (updatedFeatures.has(evaluator.id)) return;
      updatedFeatures.add(evaluator.id);

      const uniqueLabels = new Set<string>();

      evaluator.evaluate(
        ({ properties }) => {
          const text = (properties?.["knj"] ?? properties?.["name"]) as string;
          const ftCode = properties?.["ftCode"] as number;
          const annoCtg = properties?.["annoCtg"] as number;

          // Filter by feature code and annotation category
          if (
            !ALLOWED_FT_CODE.includes(ftCode) ||
            (annoCtg && !ALLOWED_ANNO_CTG.includes(annoCtg))
          ) {
            return { text: "", show: false };
          }

          // Deduplicate labels
          if (uniqueLabels.has(text)) {
            return { text: "", show: false };
          }

          uniqueLabels.add(text);

          return {
            text,
            show: !!text,
          };
        },
        { filters: ["knj", "name", "ftCode", "annoCtg"] },
      );
    });

    return layer;
  };

  let layer = addMvtLayer();

  // Control panel
  const pane = new Pane({ title: "MVT Text Styling" });
  addDateControl(view, pane);

  // Toggle button to add/remove layer
  const toggleBtn = pane.addButton({ title: "Remove Layer", label: "layer" });
  toggleBtn.on("click", () => {
    if (layer) {
      view.deleteLayerById(layer.id);
      layer = undefined as unknown as typeof layer;
      toggleBtn.title = "Add Layer";
    } else {
      layer = addMvtLayer();
      toggleBtn.title = "Remove Layer";
    }
  });

  pane
    .addBinding(params, "size", { min: 10, max: 50, step: 1 })
    .on("change", ({ value }) => {
      layer?.update({ text: { size: value } });
    });

  showAttributions([
    TILE_DATASETS.openstreetmap,
    VECTOR_DATASETS.gsiExperimentalVector,
  ]);
};

run();
