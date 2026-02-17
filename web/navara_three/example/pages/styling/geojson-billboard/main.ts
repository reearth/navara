import ThreeView, { Color, JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../../helpers/attributions";
import { TERRAIN_DATASETS, TILE_DATASETS } from "../../../helpers/constants";
import { addDateControl } from "../../../helpers/control";

const run = async () => {
  const view = new ThreeView({ debug: true });
  await view.init();

  view.addDefaultAtmosphereLayers();

  view.setCamera({
    lng: 138.733,
    lat: 35.23,
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

  const params = { size: 0.05 };

  // GeoJSON billboard layer
  const addGeoJsonLayer = () => {
    updatedFeatures = new Set<bigint>();

    const layer = view.addLayer({
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { type: "point", No: 1 },
            geometry: {
              coordinates: [138.73470764482283, 35.3627947204036],
              type: "Point",
            },
          },
          {
            type: "Feature",
            properties: { type: "point", No: 2 },
            geometry: {
              coordinates: [138.7311922738062, 35.359766379480206],
              type: "Point",
            },
          },
        ],
      },
      billboard: {
        color: new Color().setStyle("#ffffff"),
        size: params.size,
        height: 1,
        scaleByDistance: true,
        clampToGround: true,
        depthTest: true,
        url: "/example.png",
      },
    });

    // Feature evaluator: style billboards based on properties
    layer.on("featureUpdated", ({ evaluator }) => {
      if (updatedFeatures.has(evaluator.id)) return;
      updatedFeatures.add(evaluator.id);

      evaluator.evaluate((_batchId, property) => {
        const num = (property?.["No"] as number) ?? 0;

        // Generate color based on feature number
        const idx = num % 6;
        const r = Math.abs(Math.sin(idx + 0));
        const g = Math.abs(Math.sin(idx + 1));
        const b = Math.abs(Math.sin(idx + 2));

        return {
          color: new Color().setRGB(r, g, b),
        };
      });
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

  pane
    .addBinding(params, "size", { min: 0.01, max: 0.2, step: 0.01 })
    .on("change", ({ value }) => {
      layer?.update({ billboard: { size: value } });
    });

  showAttributions([TILE_DATASETS.openstreetmap]);
};

run();
