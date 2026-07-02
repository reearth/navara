import ThreeView, { Color } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import { Pane } from "tweakpane";

import { showAttributions } from "../../../helpers/attributions";
import {
  GEOJSON_DATASETS,
  TERRAIN_DATASETS,
  TILE_DATASETS,
} from "../../../helpers/constants";
import { addDateControl } from "../../../helpers/control";

import WORLD_FONT_FAMILY from "./worldCitiesFontFamily.json";

const run = async () => {
  const view = new ThreeView({
    debug: true,
  });

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  await view.init();

  defaultPlugin.addDefaultPhotorealScene();

  // Register the multi-script font family
  view.addFontFamily(WORLD_FONT_FAMILY);

  // Global view: show all cities
  view.setCamera({
    lng: 30,
    lat: 20,
    height: 20_000_000,
    heading: 0,
    pitch: -90,
    roll: 0,
  });

  // Base tiles
  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: { maxZoom: 19 },
  });

  // Track updated features to prevent duplicate evaluations
  let updatedFeatures = new Set<bigint>();

  const params = {
    size: 15,
    // Two-line labels ("name\ncountry") demonstrating explicit line breaks
    twoLine: false,
    // Wrap width in ems (multiples of size); 0 disables wrapping
    maxWidth: 0,
    lineHeight: 1.0,
    textAlign: "center" as "left" | "center" | "right",
  };

  // GeoJSON text layer with font faces: city names in native scripts
  const addCityLayer = () => {
    updatedFeatures = new Set<bigint>();

    const layer = view.addLayer({
      type: "geojson",
      data: { url: GEOJSON_DATASETS.worldCities.url },
      text: {
        font: "WorldCities", // Uses the registered font family name
        color: new Color().setStyle("#ffffff"),
        size: params.size,
        sizeInMeters: false,
        clampToGround: true,
        depthTest: true,
        center: { x: 0.5, y: 0.0 },
        outlineColor: new Color().setStyle("#000000"),
        outlineWidth: 5,
        outlineOpacity: 0.5,
        maxWidth: params.maxWidth,
        lineHeight: params.lineHeight,
        textAlign: params.textAlign,
      },
    });

    layer.on("featureUpdated", ({ evaluator }) => {
      if (updatedFeatures.has(evaluator.id)) return;
      updatedFeatures.add(evaluator.id);

      evaluator.evaluate(
        ({ properties }) => {
          const name = properties?.["name"] as string | undefined;
          const country = properties?.["country"] as string | undefined;
          const text =
            params.twoLine && name && country ? `${name}\n${country}` : name;
          return {
            text: text ?? "",
            show: !!name,
          };
        },
        { filters: ["name", "country"] },
      );
    });

    return layer;
  };

  let layer: ReturnType<typeof addCityLayer> | undefined = addCityLayer();

  // Control panel
  const pane = new Pane({ title: "GeoJSON Font Faces" });
  addDateControl(view, pane);

  const toggleBtn = pane.addButton({ title: "Remove Layer", label: "layer" });
  toggleBtn.on("click", () => {
    if (layer) {
      view.deleteLayerById(layer.id);
      layer = undefined;
      toggleBtn.title = "Add Layer";
    } else {
      layer = addCityLayer();
      toggleBtn.title = "Remove Layer";
    }
  });

  pane
    .addBinding(params, "size", { min: 10, max: 60, step: 1 })
    .on("change", ({ value }) => {
      layer?.update({ text: { size: value } });
    });

  // Text-layout controls: explicit line breaks, word wrapping, alignment.
  const rebuildLayer = () => {
    if (!layer) return;
    view.deleteLayerById(layer.id);
    layer = addCityLayer();
  };

  pane.addBinding(params, "twoLine").on("change", rebuildLayer);

  pane
    .addBinding(params, "maxWidth", { min: 0, max: 20, step: 0.5 })
    .on("change", ({ value }) => {
      layer?.update({ text: { maxWidth: value } });
    });

  pane
    .addBinding(params, "lineHeight", { min: 0.5, max: 3, step: 0.1 })
    .on("change", ({ value }) => {
      layer?.update({ text: { lineHeight: value } });
    });

  pane
    .addBinding(params, "textAlign", {
      options: { Left: "left", Center: "center", Right: "right" },
    })
    .on("change", ({ value }) => {
      layer?.update({ text: { textAlign: value } });
    });

  showAttributions([TILE_DATASETS.openstreetmap, TERRAIN_DATASETS.mapterhorn]);
};

run();
