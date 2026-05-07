import ThreeView, { Color, JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import { ToneMappingMode } from "@navara/three_default_descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";
import { Pane } from "tweakpane";

import { showAttributions } from "../../../helpers/attributions";
import { FLOOD_RANK_COLOR_MAP } from "../../../helpers/colors";
import {
  LOCAL_DATASETS,
  TERRAIN_DATASETS,
  TILE_DATASETS,
} from "../../../helpers/constants";
import { addDateControl } from "../../../helpers/control";

type CustomDescriptions = DefaultDescriptions;

const run = async () => {
  const view = new ThreeView<CustomDescriptions>({
    debug: true,
    hideUnderground: false,
  });
  view.addPlugin(new DefaultPlugin());

  await view.init();

  view.addLight({
    sun: {},
  });

  view.addEffect({
    toneMapping: {
      mode: ToneMappingMode.NEUTRAL,
    },
  });

  view.toneMappingExposure = 5;

  view.setCamera({
    lng: 139.841,
    lat: 35.5718,
    height: 9500,
    heading: -70,
    pitch: -41,
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

  const FLOOD_DEPTH_BY_RANK = [0.5, 3.0, 5.0, 10.0, 20.0];

  // GeoJSON polygon layer - using interior GeoJSON dataset
  const addGeoJsonLayer = () => {
    updatedFeatures = new Set<bigint>();

    const layer = view.addLayer({
      type: "geojson",
      data: { url: LOCAL_DATASETS.tokyoFlood.url },
      polygon: {
        color: new Color().setStyle("#ffffff"),
        height: 0,
        extrudedHeight: 0,
        clampToGround: false,
        outline: true,
        outlineShow: params.outlineShow,
        outlineWidth: 2,
        outlineColor: new Color().setHex(0xff00ff),
        tiled: true,
      },
    });

    // Feature evaluator: style polygons based on properties
    layer.on("featureUpdated", ({ evaluator }) => {
      if (updatedFeatures.has(evaluator.id)) return;
      updatedFeatures.add(evaluator.id);

      evaluator.evaluate(
        ({ properties }) => {
          const rank = Number(properties?.["A31a_205"] ?? 1);
          const depth = FLOOD_DEPTH_BY_RANK[rank - 1];

          const [r, g, b] = FLOOD_RANK_COLOR_MAP[rank];

          return {
            extrudedHeight: depth,
            color: new Color().setRGB(r / 255, g / 255, b / 255),
          };
        },
        { filters: ["A31a_205"] },
      );
    });

    return layer;
  };

  let layer: ReturnType<typeof addGeoJsonLayer> | undefined = addGeoJsonLayer();

  // Control panel
  const pane = new Pane({ title: "GeoJSON Polygon" });
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
    LOCAL_DATASETS.tokyoFlood,
  ]);
};

run();
