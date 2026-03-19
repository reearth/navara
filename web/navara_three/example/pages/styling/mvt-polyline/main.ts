import ThreeView, { Color, JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import { Pane } from "tweakpane";

import { showAttributions } from "../../../helpers/attributions";
import {
  MVT_DATASETS,
  TERRAIN_DATASETS,
  TILE_DATASETS,
} from "../../../helpers/constants";
import { addDateControl } from "../../../helpers/control";

const run = async () => {
  const view = new ThreeView({
    debug: true,
  });

  const defaultPlugin = new DefaultPlugin();
  await view.addPlugin(defaultPlugin);

  await view.init();

  defaultPlugin.addDefaultPhotorealLayers();

  // Camera position for Gifu
  view.setCamera({
    lng: 136.76,
    lat: 35.39,
    height: 3000,
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

  const params = { width: 5 };

  // MVT polyline layer: Roads in Gifu
  const addMvtLayer = () => {
    updatedFeatures = new Set<bigint>();

    const layer = view.addLayer({
      type: "mvt",
      data: { url: MVT_DATASETS.plateauGifuTran.url },
      polyline: {
        width: params.width,
        height: 1,
        clampToGround: true,
        useGroundNormals: true,
      },
      vectorTile: { maxZoom: 16 },
    });

    // Feature evaluator: style roads based on tree presence
    layer.on("featureUpdated", ({ evaluator }) => {
      if (updatedFeatures.has(evaluator.id)) return;
      updatedFeatures.add(evaluator.id);

      evaluator.evaluate(
        ({ properties }) => {
          const rawAttributes = properties?.["attributes"];
          const attrs =
            typeof rawAttributes === "string" ? JSON.parse(rawAttributes) : {};
          const generics = attrs["gen:genericAttribute"] as unknown[];

          // Find tree presence info
          const treeInfo = generics?.find(
            (g) =>
              g &&
              typeof g === "object" &&
              "name" in g &&
              g.name === "樹木の有無",
          ) as { value: { value: string }[] } | undefined;

          const code = treeInfo?.value[0]?.value;

          // Color based on street tree presence
          const color = (() => {
            // Has street trees
            if (code === "1") {
              return 0x00ff00;
            }
            return 0x777777;
          })();

          return {
            color: new Color().setHex(color),
          };
        },
        { filters: ["attributes"] },
      );
    });

    return layer;
  };

  let layer = addMvtLayer();

  // Control panel
  const pane = new Pane({ title: "MVT Polyline Styling" });
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
    .addBinding(params, "width", { min: 1, max: 20, step: 1 })
    .on("change", ({ value }) => {
      layer?.update({ polyline: { width: value } });
    });

  showAttributions([TILE_DATASETS.openstreetmap, MVT_DATASETS.plateauGifuTran]);
};

run();
