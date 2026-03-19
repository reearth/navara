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

  view.setCamera({
    lng: 139.6,
    lat: 35.48,
    height: 20000,
    heading: 0,
    pitch: -48,
    roll: 0,
  });

  // Base tiles layer
  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.gsiSeamlessphoto.url },
    rasterTile: { maxZoom: 18 },
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

  // Color parameters for different fire prevention district types
  const colorParams = {
    防火地域: "#0000ff",
    準防火地域: "#00ff00",
    その他: "#ff0000",
  };
  const currentColors = { ...colorParams };

  // MVT draped polygon layer: Fire Prevention Districts (flat overlay on terrain)
  const addMvtLayer = () => {
    const layer = view.addLayer({
      type: "mvt",
      data: { url: MVT_DATASETS.plateauTokyoFirePrevention.url },
      polygon: {
        height: 0,
        clampToGround: true,
        wireframe: false,
        opacity: 0.6,
      },
      vectorTile: { maxZoom: 16 },
    });

    // Feature evaluator: style polygons based on fire prevention type
    layer.on("featureUpdated", ({ evaluator }) => {
      evaluator.evaluate(
        ({ properties }) => {
          const functionType = properties?.["urf_function"] as string;

          const color = (() => {
            // Fireproof area
            if (functionType === "防火地域") {
              return currentColors["防火地域"];
            }
            // Semi-fireproof area
            if (functionType === "準防火地域") {
              return currentColors["準防火地域"];
            }
            return currentColors["その他"];
          })();

          return {
            color: new Color().setStyle(color),
          };
        },
        { filters: ["urf_function"] },
      );
    });

    return layer;
  };

  let layer = addMvtLayer();

  // Control panel
  const pane = new Pane({ title: "MVT Draped Polygon" });
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

  const colorFolder = pane.addFolder({ title: "Colors", expanded: true });

  for (const key of Object.keys(colorParams) as (keyof typeof colorParams)[]) {
    colorFolder.addBinding(colorParams, key).on("change", ({ value }) => {
      currentColors[key] = value;
      layer?.forceUpdate();
    });
  }

  showAttributions([
    TILE_DATASETS.gsiSeamlessphoto,
    MVT_DATASETS.plateauTokyoFirePrevention,
  ]);
};

run();
