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

  const params = { width: 10 };

  // GeoJSON polyline layer with feature evaluator
  const addGeoJsonLayer = () => {
    updatedFeatures = new Set<bigint>();

    const layer = view.addLayer({
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { type: "line", No: 1 },
            geometry: {
              coordinates: [
                [138.67683541875112, 35.4173874936028],
                [138.7969673531889, 35.42047906868497],
                [138.65597039856073, 35.284337599745484],
                [138.82415510677106, 35.313235266691635],
              ],
              type: "LineString",
            },
          },
          {
            type: "Feature",
            properties: { type: "line", No: 2 },
            geometry: {
              coordinates: [
                [138.79254143981473, 35.436965465402466],
                [138.68631951883958, 35.44005628905532],
                [138.78558643308418, 35.32510096156801],
                [138.63194401167237, 35.31684674944552],
              ],
              type: "LineString",
            },
          },
        ],
      },
      polyline: {
        show: true,
        color: new Color().setStyle("#ff0000"),
        width: params.width,
        height: 1,
        clampToGround: true,
        useGroundNormals: true,
      },
    });

    // Feature evaluator: style polylines based on properties
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
  const pane = new Pane({ title: "GeoJSON Polyline Styling" });
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
    .addBinding(params, "width", { min: 1, max: 20, step: 1 })
    .on("change", ({ value }) => {
      layer?.update({ polyline: { width: value } });
    });

  showAttributions([TILE_DATASETS.openstreetmap]);
};

run();
