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
    shadow: true,
  });

  const defaultPlugin = new DefaultPlugin();
  await view.addPlugin(defaultPlugin);

  await view.init();

  const defaultAtmospheres = defaultPlugin.addDefaultPhotorealLayers();
  defaultAtmospheres.sun.update({
    sun: { intensity: 2, castShadow: true, shadowIntensity: 0.9 },
  });

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

  // Color parameters for different height categories
  const colorParams = {
    "< 1m": "#00ff00",
    "< 10m": "#ffff00",
    "< 30m": "#ff00ff",
    ">= 30m": "#ff0000",
  };
  const currentColors = { ...colorParams };

  // Scale parameters for different height categories
  const scaleParams = {
    "< 1m": 100,
    "< 10m": 100,
    "< 30m": 100,
    ">= 30m": 100,
  };
  const currentScales = { ...scaleParams };

  // MVT extruded polygon layer: Height Control District
  const addMvtLayer = () => {
    const layer = view.addLayer({
      type: "mvt",
      data: { url: MVT_DATASETS.plateauTokyoHeightControl.url },
      polygon: {
        height: 0,
        extrudedHeight: 0,
        clampToGround: false,
        wireframe: false,
        castShadow: true,
        receiveShadow: true,
      },
      vectorTile: { maxZoom: 16 },
    });

    // Feature evaluator: style polygons based on height attributes
    layer.on("featureUpdated", ({ evaluator }) => {
      evaluator.evaluate(
        ({ properties }) => {
          const attributes = JSON.parse(
            (properties?.["attributes"] as string) ?? "{}",
          );
          const minHeight = attributes["urf:minimumBuildingHeight"];
          const maxHeight = attributes["urf:maximumBuildingHeight"];
          const extrudedHeight = Math.max(maxHeight ?? minHeight ?? 0, 1);

          // Color and scale based on height category
          const [color, scale] = (() => {
            if (extrudedHeight <= 1)
              return [currentColors["< 1m"], currentScales["< 1m"]];
            if (extrudedHeight < 10)
              return [currentColors["< 10m"], currentScales["< 10m"]];
            if (extrudedHeight < 30)
              return [currentColors["< 30m"], currentScales["< 30m"]];
            return [currentColors[">= 30m"], currentScales[">= 30m"]];
          })();

          return {
            color: new Color().setStyle(color),
            extrudedHeight: extrudedHeight * scale,
          };
        },
        { filters: ["attributes"] },
      );
    });

    return layer;
  };

  let layer = addMvtLayer();

  // Control panel
  const pane = new Pane({ title: "MVT Extruded Polygon" });
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

  const scaleFolder = pane.addFolder({ title: "Scale", expanded: false });

  for (const key of Object.keys(scaleParams) as (keyof typeof scaleParams)[]) {
    scaleFolder
      .addBinding(scaleParams, key, { min: 0 })
      .on("change", ({ value }) => {
        currentScales[key] = value;
        layer?.forceUpdate();
      });
  }

  showAttributions([
    TILE_DATASETS.gsiSeamlessphoto,
    TERRAIN_DATASETS.gsi,
    MVT_DATASETS.plateauTokyoHeightControl,
  ]);
};

run();
