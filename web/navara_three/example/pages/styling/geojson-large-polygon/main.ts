import ThreeView, {
  Color,
  JAPAN_GSI_ELEVATION_DECODER,
  ToneMappingMode,
} from "@navara/three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../../helpers/attributions";
import { FLOOD_RANK_COLOR_MAP } from "../../../helpers/colors";
import {
  LOCAL_DATASETS,
  TERRAIN_DATASETS,
  TILE_DATASETS,
} from "../../../helpers/constants";
import { addDateControl } from "../../../helpers/control";

const run = async () => {
  const view = new ThreeView({ debug: true, hideUnderground: false });
  await view.init();

  view.addLayer({
    type: "light",
    sun: {},
  });

  view.addLayer({
    type: "effect",
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

  // Track updated features to prevent duplicate evaluations
  let updatedFeatures = new Set<bigint>();

  const params = { outlineShow: false };

  const FLOOD_DEPTH_BY_RANK = [0.5, 3.0, 5.0, 10.0, 20.0];

  // GeoJSON extruded polygon layer - using interior GeoJSON dataset
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
        outlineShow: params.outlineShow,
        outlineWidth: 2,
        outlineColor: new Color().setHex(0xff00ff),
      },
    });

    // Feature evaluator: style polygons based on properties
    layer.on("featureUpdated", ({ evaluator }) => {
      if (updatedFeatures.has(evaluator.id)) return;
      updatedFeatures.add(evaluator.id);

      evaluator.evaluate((_batchId, property) => {
        const rank = Number(property?.["A31a_205"] ?? 1);
        const depth = FLOOD_DEPTH_BY_RANK[rank - 1];

        const [r, g, b] = FLOOD_RANK_COLOR_MAP[rank];

        return {
          extrudedHeight: depth,
          color: new Color().setRGB(r / 255, g / 255, b / 255),
        };
      });
    });

    return layer;
  };

  let layer = addGeoJsonLayer();

  // Control panel
  const pane = new Pane({ title: "GeoJSON Extruded Polygon" });
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
