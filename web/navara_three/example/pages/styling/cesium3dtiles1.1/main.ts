import ThreeView, {
  Color,
  JAPAN_GSI_ELEVATION_DECODER,
  type Nullable,
  type PickedFeature,
} from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import { Pane } from "tweakpane";

import { showAttributions } from "../../../helpers/attributions";
import { PLATEAU_COLOR_MAP, YlGnBu_COLOR_MAP } from "../../../helpers/colors";
import {
  TERRAIN_DATASETS,
  TILE_DATASETS,
  TILES_3D_DATASETS,
} from "../../../helpers/constants";
import { addDateControl } from "../../../helpers/control";

const run = async () => {
  const view = new ThreeView({
    debug: true,
    shadow: true,
  });

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  await view.init();

  const defaultAtmospheres = defaultPlugin.addDefaultPhotorealScene();
  defaultAtmospheres.sun.update({
    sun: {
      intensity: 2,
      castShadow: true,
      shadowFar: 5000,
      shadowIntensity: 0.9,
    },
  });

  view.setCamera({
    lng: 140.2422905195,
    lat: 40.7453853644,
    height: 2880.62,
    heading: 328.693438934,
    pitch: -38.4179591915,
    roll: 0,
  });

  // Base layers
  view.addLayer({
    type: "tiles",
    data: {
      url: TILE_DATASETS.gsiSeamlessphoto.url,
    },
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

  // Color and visibility parameters
  const colorParams = {
    "< 5m": "#00ff00",
    "< 15m": "#ffff00",
    "< 30m": "#ff00ff",
    ">= 30m": "#ff0000",
  };
  const currentColors = { ...colorParams };

  const showParams = {
    "< 5m": false,
    "< 15m": true,
    "< 30m": true,
    ">= 30m": true,
  };
  const currentShow = { ...showParams };

  const colorModeParams = {
    colorMap: "None" as "None" | "Plateau" | "YlGnBu",
  };

  // Cesium 3D Tiles layer
  const add3DTilesLayer = () => {
    const layer = view.addLayer({
      type: "cesium3dtiles",
      data: { url: TILES_3D_DATASETS.plateauAjigasawa.url },
      model: {
        show: true,
        color: new Color().setStyle("#ffffff"),
        metalness: 0,
        roughness: 1,
        castShadow: true,
        receiveShadow: true,
        height: -60,
      },
    });

    let selectedId: string | undefined = undefined;
    const pickHandler = (info: Nullable<PickedFeature>) => {
      if (info?.layerId !== layer.id) return;
      selectedId = info?.properties?.["gml_id"] as string;
      layer.forceUpdate();
    };
    view.on("pick", pickHandler);

    // Feature evaluator: style buildings based on measured height
    layer.on("featureUpdated", ({ evaluator }) => {
      evaluator.evaluate(
        ({ properties }) => {
          const measuredHeight =
            (properties?.["bldg:measuredHeight"] as number) ?? 0;

          if (selectedId && selectedId === properties?.["gml_id"]) {
            return { color: new Color().setHex(0x00ffff), show: true };
          }

          // Determine visibility by height bucket
          const show = (() => {
            if (measuredHeight < 5) return currentShow["< 5m"];
            if (measuredHeight < 15) return currentShow["< 15m"];
            if (measuredHeight < 30) return currentShow["< 30m"];
            return currentShow[">= 30m"];
          })();

          // Determine color: either by colormap or by threshold
          const color = (() => {
            if (colorModeParams.colorMap !== "None") {
              // Gradation by height using color map
              const min = 3;
              const max = 37.8;
              const t = Math.max(
                0,
                Math.min(1, (measuredHeight - min) / (max - min)),
              );
              const colorMap =
                colorModeParams.colorMap === "YlGnBu"
                  ? YlGnBu_COLOR_MAP
                  : PLATEAU_COLOR_MAP;
              const [r, g, b] = colorMap.linear(t);
              return new Color().setRGB(r, g, b);
            }

            // Threshold-based coloring
            if (measuredHeight < 5)
              return new Color().setStyle(currentColors["< 5m"]);
            if (measuredHeight < 15)
              return new Color().setStyle(currentColors["< 15m"]);
            if (measuredHeight < 30)
              return new Color().setStyle(currentColors["< 30m"]);
            return new Color().setStyle(currentColors[">= 30m"]);
          })();

          return { color, show };
        },
        { filters: ["bldg:measuredHeight", "gml_id"] },
      );
    });

    return { layer, removePickHandler: () => view.off("pick", pickHandler) };
  };

  let result: ReturnType<typeof add3DTilesLayer> | undefined =
    add3DTilesLayer();

  // Control panel
  const pane = new Pane({ title: "Cesium 3D Tiles Styling" });
  addDateControl(view, pane);

  // Toggle button to add/remove layer
  const toggleBtn = pane.addButton({ title: "Remove Layer", label: "layer" });
  toggleBtn.on("click", () => {
    if (result) {
      result.removePickHandler?.();
      view.deleteLayerById(result.layer.id);
      result = undefined;
      toggleBtn.title = "Add Layer";
    } else {
      result = add3DTilesLayer();
      toggleBtn.title = "Remove Layer";
    }
  });

  // Color map selector
  pane
    .addBinding(colorModeParams, "colorMap", {
      options: { None: "None", Plateau: "Plateau", YlGnBu: "YlGnBu" },
    })
    .on("change", () => {
      result?.layer.forceUpdate();
    });

  // Color controls
  const colorFolder = pane.addFolder({
    title: "Threshold Colors",
    expanded: false,
  });
  for (const key of Object.keys(colorParams) as (keyof typeof colorParams)[]) {
    colorFolder.addBinding(colorParams, key).on("change", ({ value }) => {
      currentColors[key] = value;
      result?.layer.forceUpdate();
    });
  }

  // Visibility controls
  const showFolder = pane.addFolder({ title: "Visibility", expanded: false });
  for (const key of Object.keys(showParams) as (keyof typeof showParams)[]) {
    showFolder.addBinding(showParams, key).on("change", ({ value }) => {
      currentShow[key] = value;
      result?.layer.forceUpdate();
    });
  }

  showAttributions([
    TILE_DATASETS.gsiSeamlessphoto,
    TERRAIN_DATASETS.gsi,
    TILES_3D_DATASETS.plateauAjigasawa,
  ]);
};

run();
