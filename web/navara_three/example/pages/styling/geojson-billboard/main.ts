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

  defaultPlugin.addDefaultPhotorealLayers();

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

  view.addLayer({
    type: "tiles",
    data: { url: TERRAIN_DATASETS.gsi.url },
    rasterTile: {
      maxZoom: 15,
    },
    hillshade: {
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    },
  });

  // Track updated features to prevent duplicate evaluations
  let updatedFeatures = new Set<bigint>();

  const params = { size: 1000.0 };

  // GeoJSON billboard layer
  const addGeoJsonLayer = () => {
    updatedFeatures = new Set<bigint>();

    const layer = view.addLayer({
      type: "geojson",
      data: {
        url: LOCAL_DATASETS.railwaysTimeSeries.url,
      },
      billboard: {
        color: new Color().setStyle("#ffffff"),
        size: params.size,
        height: 1,
        sizeInMeters: true,
        clampToGround: true,
        depthTest: true,
        url: "/example.png",
        transparent: true,
        center: { x: 0.0, y: -0.5 },
      },
    });

    // Feature evaluator: style billboards based on properties
    layer.on("featureUpdated", ({ evaluator }) => {
      if (updatedFeatures.has(evaluator.id)) return;
      updatedFeatures.add(evaluator.id);

      evaluator.evaluate(
        ({ properties }) => {
          const isStopped = (properties?.["N05_005e"] as string) === "9999";

          return {
            color: new Color().setHex(isStopped ? 0xff0000 : 0xffffff),
          };
        },
        { filters: ["N05_005e"] },
      );
    });

    return layer;
  };

  let layer = addGeoJsonLayer();

  // Control panel
  const pane = new Pane({ title: "GeoJSON Billboard Styling" });
  addDateControl(view, pane);

  // Toggle button to add/remove layer
  const toggleBtn = pane.addButton({ title: "Remove Layer", label: "layer" });
  toggleBtn.on("click", () => {
    if (layer) {
      view.deleteLayerById(layer.id);
      layer = undefined as unknown as typeof layer;
      toggleBtn.title = "Add Layer";
    } else {
      layer = addGeoJsonLayer();
      toggleBtn.title = "Remove Layer";
    }
  });

  pane.addBinding(params, "size").on("change", ({ value }) => {
    layer?.update({ billboard: { size: value } });
  });

  showAttributions([
    TILE_DATASETS.openstreetmap,
    LOCAL_DATASETS.railwaysTimeSeries,
  ]);
};

run();
