import ThreeView, { Color, JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import {
  DefaultPlugin,
  type DefaultLayerDescriptions,
} from "@navara/three_default_plugin";
import { Pane } from "tweakpane";

import { showAttributions } from "../../../helpers/attributions";
import {
  LOCAL_DATASETS,
  TERRAIN_DATASETS,
  TILE_DATASETS,
} from "../../../helpers/constants";
import { addDateControl } from "../../../helpers/control";

const run = async () => {
  const view = new ThreeView<DefaultLayerDescriptions>({
    debug: true,
    shadow: true,
  });

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  await view.init();

  const defaultAtmospheres = defaultPlugin.addDefaultPhotorealLayers();
  defaultAtmospheres.sun.update({
    sun: { intensity: 2, castShadow: true, shadowFar: 5000 },
  });

  view.addLayer({
    type: "light",
    ambient: {
      intensity: 0.5,
    },
  });

  view.setCamera({
    lng: 139.77,
    lat: 35.676,
    height: 300,
    heading: -45,
    pitch: -35,
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

  const params = { outlineShow: false };

  // GeoJSON extruded polygon layer - using interior GeoJSON dataset
  const addGeoJsonLayer = () => {
    updatedFeatures = new Set<bigint>();

    const layer = view.addLayer({
      type: "geojson",
      data: { url: LOCAL_DATASETS.interiorGeoJSON.url },
      polygon: {
        color: new Color().setStyle("#ffffff"),
        height: 5,
        extrudedHeight: 0,
        clampToGround: false,
        castShadow: true,
        receiveShadow: true,
        outline: true,
        outlineShow: params.outlineShow,
        outlineWidth: 2,
        outlineColor: new Color().setHex(0xff00ff),
      },
    });

    // Feature evaluator: style polygons based on properties
    layer.on("featureUpdated", ({ evaluator }) => {
      if (updatedFeatures.has(evaluator.id)) return;
      updatedFeatures.add(evaluator.id);

      evaluator.evaluate(
        ({ properties }) => {
          const height = (properties?.["height"] as number) ?? 0;
          const color = (properties?.["color"] as string) ?? "#ffffff";
          const extrudedHeight =
            (properties?.["extrudedHeight"] as number) ?? 0;

          return {
            height,
            extrudedHeight,
            color: new Color().setStyle(color),
          };
        },
        { filters: ["height", "color", "extrudedHeight"] },
      );
    });

    return layer;
  };

  let layer: ReturnType<typeof addGeoJsonLayer> | undefined = addGeoJsonLayer();

  // Control panel
  const pane = new Pane({ title: "GeoJSON Extruded Polygon" });
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

  pane.addBinding(params, "outlineShow").on("change", ({ value }) => {
    layer?.update({ polygon: { outlineShow: value } });
  });

  showAttributions([
    TILE_DATASETS.gsiSeamlessphoto,
    TERRAIN_DATASETS.gsi,
    LOCAL_DATASETS.interiorGeoJSON,
  ]);
};

run();
