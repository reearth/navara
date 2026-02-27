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
  view.addPlugin(defaultPlugin);

  await view.init();

  defaultPlugin.addDefaultPhotorealLayers();

  // Camera position for Wakayama
  view.setCamera({
    lng: 135.18,
    lat: 34.07,
    height: 15000,
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

  const params = { size: 500 };

  // MVT point layer: Heliports in Wakayama
  const addMvtLayer = () => {
    updatedFeatures = new Set<bigint>();

    const layer = view.addLayer({
      type: "mvt",
      data: { url: MVT_DATASETS.plateauWakayamaGen.url },
      point: {
        size: params.size,
        scaleByDistance: true,
        clampToGround: true,
        color: new Color().setStyle("#ff0000"),
        center: { x: 0, y: -0.5 },
      },
    });

    // Feature evaluator: style points based on properties
    layer.on("featureUpdated", ({ evaluator }) => {
      if (updatedFeatures.has(evaluator.id)) return;
      updatedFeatures.add(evaluator.id);

      evaluator.evaluate((_batchId, property) => {
        const type = property?.["備考"] as string;

        // Color based on heliport type
        const color = (() => {
          // Athletic field (陸上競技場)
          if (type === "陸上競技場") {
            return 0x0000ff;
          }
          // Riverbed (河川敷)
          if (type?.endsWith("河川敷")) {
            return 0x00ff00;
          }
          return 0xff0000;
        })();

        return {
          color: new Color().setHex(color),
        };
      });
    });

    return layer;
  };

  let layer = addMvtLayer();

  // Control panel
  const pane = new Pane({ title: "MVT Point Styling" });
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

  pane.addBinding(params, "size").on("change", ({ value }) => {
    layer?.update({ point: { size: value } });
  });

  showAttributions([
    TILE_DATASETS.openstreetmap,
    MVT_DATASETS.plateauWakayamaGen,
  ]);
};

run();
