import ThreeView, {
  Color,
  JAPAN_GSI_ELEVATION_DECODER,
} from "@navaramap/three";
import { DefaultPlugin } from "@navaramap/three-default-plugin";
import { Pane } from "tweakpane";

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
  view.addPlugin(defaultPlugin);

  const attribution = view.attribution;

  await view.init();

  defaultPlugin.addDefaultPhotorealScene();

  view.setCamera({
    lng: 139.6,
    lat: 35.48,
    height: 20000,
    heading: 0,
    pitch: -48,
    roll: 0,
  });

  // Base tiles layer
  const seamlessphoto = view.addSource({
    type: "raster-tile",
    url: TILE_DATASETS.gsiSeamlessphoto.url,
    maxZoom: 18,
  });
  view.addLayer({ type: "raster", source: seamlessphoto });

  const gsiTerrain = view.addSource({
    type: "raster-dem",
    url: TERRAIN_DATASETS.gsi.url,
    elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    maxZoom: 15,
  });
  view.addLayer({
    type: "terrain",
    source: gsiTerrain,
    terrain: {
      castShadow: true,
      receiveShadow: true,
    },
  });

  view.addLayer({
    type: "raster",
    source: gsiTerrain,
    hillshade: {},
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
    const firePreventionSource = view.addSource({
      type: "vector-tile",
      url: MVT_DATASETS.plateauTokyoFirePrevention.url,
      maxZoom: 16,
    });
    const layer = view.addLayer({
      type: "vector",
      source: firePreventionSource,
      polygon: {
        height: 0,
        clampToGround: true,
        wireframe: false,
        opacity: 0.6,
      },
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

  let layer: ReturnType<typeof addMvtLayer> | undefined = addMvtLayer();

  // Control panel
  const pane = new Pane({ title: "MVT Draped Polygon" });
  addDateControl(view, pane);

  // Toggle button to add/remove layer
  const toggleBtn = pane.addButton({ title: "Remove Layer", label: "layer" });
  toggleBtn.on("click", () => {
    if (layer) {
      view.deleteLayerById(layer.id);
      layer = undefined;
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

  attribution?.add([
    TILE_DATASETS.gsiSeamlessphoto,
    TERRAIN_DATASETS.gsi,
    MVT_DATASETS.plateauTokyoFirePrevention,
  ]);
};

run();
