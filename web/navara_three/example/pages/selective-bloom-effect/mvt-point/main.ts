import ThreeView, { Color, JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

import { showAttributions } from "../../../helpers/attributions";
import {
  MVT_DATASETS,
  TERRAIN_DATASETS,
  TILE_DATASETS,
} from "../../../helpers/constants";

const run = async () => {
  const view = new ThreeView({ debug: true, shadow: true });

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  await view.init();

  const defaultAtmospheres = defaultPlugin.addDefaultPhotorealLayers();
  defaultAtmospheres.sun.update({
    sun: { intensity: 1, castShadow: true },
  });

  view.atmosphere.date.setHours(8);

  // Camera position for Wakayama
  view.setCamera({
    lng: 135.18,
    lat: 34.07,
    height: 15000,
    heading: 0,
    pitch: -45,
    roll: 0,
  });

  // Selective bloom effect
  const bloomEffect = view.addLayer({
    type: "effect",
    selectiveBloom: {
      strength: 1.0,
      radius: 0.5,
      threshold: 0.0,
    },
  });

  // MVT point with bloom (Wakayama facilities)
  const layer = view.addLayer({
    type: "mvt",
    data: { url: MVT_DATASETS.plateauWakayamaGen.url },
    point: {
      size: 500,
      scaleByDistance: true,
      clampToGround: true,
      color: new Color().setHex(0xffcc00),
      center: { x: 0, y: -0.5 },
      effectIds: [bloomEffect.id],
      emissiveIntensity: 0.5,
      selectiveEffectOcclusion: "normal",
    },
    vectorTile: {
      maxZoom: 16,
    },
  });

  layer.on("featureUpdated", ({ evaluator }) => {
    evaluator.evaluate(
      ({ properties }) => {
        const type = properties?.["備考"] as string;

        const color = (() => {
          if (type === "陸上競技場") return new Color().setHex(0x0000ff);
          if (type?.endsWith("河川敷")) return new Color().setHex(0x00ff00);
          return new Color().setHex(0xffcc00);
        })();

        return { color };
      },
      { filters: ["備考"] },
    );
  });

  // Base layers
  view.addLayer({
    type: "terrain",
    data: { url: TERRAIN_DATASETS.gsi.url },
    rasterTerrain: {
      maxZoom: 15,
      minZoom: 5,
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
      castShadow: true,
      receiveShadow: true,
    },
  });

  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: { maxZoom: 23 },
  });

  showAttributions([
    TILE_DATASETS.openstreetmap,
    TERRAIN_DATASETS.gsi,
    MVT_DATASETS.plateauWakayamaGen,
  ]);
};

run();
