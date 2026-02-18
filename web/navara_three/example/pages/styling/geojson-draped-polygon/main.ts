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
    lng: 138.753,
    lat: 35.2,
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

  const params = { opacity: 0.7 };

  // GeoJSON draped polygon layer - same data as override-material
  const addGeoJsonLayer = () => {
    updatedFeatures = new Set<bigint>();

    const layer = view.addLayer({
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { type: "polygon", No: 1 },
            geometry: {
              coordinates: [
                [
                  [138.69076314566468, 35.43223503721363],
                  [138.68002181948253, 35.33332769554936],
                  [138.83040038604383, 35.37455382402081],
                  [138.83545512777675, 35.42708660707885],
                  [138.69076314566468, 35.43223503721363],
                ],
              ],
              type: "Polygon",
            },
          },
          {
            type: "Feature",
            properties: { type: "polygon", No: 2 },
            geometry: {
              coordinates: [
                [
                  [138.83166407147775, 35.37249301745116],
                  [138.68002181948253, 35.330750363829665],
                  [138.66991233601522, 35.26164726716193],
                  [138.81776353171153, 35.263710900396646],
                  [138.83166407147775, 35.37249301745116],
                ],
              ],
              type: "Polygon",
            },
          },
        ],
      },
      polygon: {
        color: new Color().setStyle("#00aaff"),
        height: 0,
        clampToGround: true,
        useGroundNormals: true,
        wireframe: false,
        opacity: params.opacity,
      },
    });

    // Feature evaluator: style polygons based on properties
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
  const pane = new Pane({ title: "GeoJSON Draped Polygon" });
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

  showAttributions([TILE_DATASETS.openstreetmap]);
};

run();
