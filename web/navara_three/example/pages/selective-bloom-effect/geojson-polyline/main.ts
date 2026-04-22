import ThreeView, { Color, JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import { Pane } from "tweakpane";

import { showAttributions } from "../../../helpers/attributions";
import {
  LOCAL_DATASETS,
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

  defaultPlugin.addDefaultPhotorealScene();

  view.setCamera({
    lng: 138.733,
    lat: 35.23,
    height: 1500000,
    heading: -10,
    pitch: -78,
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

  // Selective bloom effect
  const bloomEffect = view.addEffect({
    selectiveBloom: {
      strength: 1.0,
      radius: 0.5,
      threshold: 0.0,
    },
  });

  // Track updated features to prevent duplicate evaluations
  let updatedFeatures = new Set<bigint>();

  const params = { width: 10 };

  // GeoJSON polyline layer with feature evaluator
  const addGeoJsonLayer = () => {
    updatedFeatures = new Set<bigint>();

    const layer = view.addLayer({
      type: "geojson",
      data: {
        url: LOCAL_DATASETS.railways.url,
      },
      polyline: {
        show: true,
        color: new Color().setStyle("#ff0000"),
        emissiveIntensity: 0.5,
        width: params.width,
        effectIds: [bloomEffect.id],
      },
    });

    // Feature evaluator: style polylines based on properties
    layer.on("featureUpdated", ({ evaluator }) => {
      if (updatedFeatures.has(evaluator.id)) return;
      updatedFeatures.add(evaluator.id);

      evaluator.evaluate(
        ({ properties }) => {
          const railwayClass = String(properties?.["N02_001"] ?? "");

          // Color by railway class (N02_001)
          const colorMap: Record<string, string> = {
            "11": "#2563eb", // JR Railway - blue
            "12": "#dc2626", // Private Railway - red
            "13": "#92400e", // Cable Railway - brown
            "14": "#9333ea", // Suspended Monorail - purple
            "15": "#0891b2", // Straddling Monorail - cyan
            "16": "#16a34a", // Guide Rail Railway - green
            "17": "#eab308", // Trackless Railway - yellow
            "21": "#ea580c", // Tramway - orange
            "22": "#ec4899", // Suspended Monorail (tramway) - pink
            "23": "#84cc16", // Straddling Monorail (tramway) - lime
            "24": "#065f46", // Guide Rail System - dark green
            "25": "#d946ef", // Maglev - magenta
          };

          return {
            color: new Color().setStyle(colorMap[railwayClass] ?? "#888888"),
          };
        },
        { filters: ["N02_001"] },
      );
    });

    return layer;
  };

  let layer: ReturnType<typeof addGeoJsonLayer> | undefined = addGeoJsonLayer();

  // Control panel
  const pane = new Pane({ title: "GeoJSON Polyline Styling" });
  addDateControl(view, pane);

  // Toggle button to add/remove layer
  const toggleBtn = pane.addButton({ title: "Remove Layer", label: "layer" });
  toggleBtn.on("click", () => {
    if (layer) {
      view.deleteLayerById(layer.id);
      layer = undefined;
      toggleBtn.title = "Add Layer";
    } else {
      layer = addGeoJsonLayer();
      toggleBtn.title = "Remove Layer";
    }
  });

  showAttributions([
    TILE_DATASETS.openstreetmap,
    TERRAIN_DATASETS.gsi,
    LOCAL_DATASETS.railways,
  ]);
};

run();
