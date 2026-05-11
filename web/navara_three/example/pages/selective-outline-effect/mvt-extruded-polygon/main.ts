import ThreeView, { Color, JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";

import { showAttributions } from "../../../helpers/attributions";
import {
  MVT_DATASETS,
  TERRAIN_DATASETS,
  TILE_DATASETS,
} from "../../../helpers/constants";

const run = async () => {
  const view = new ThreeView<DefaultDescriptions>({
    debug: true,
    shadow: true,
  });

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  await view.init();

  const defaultAtmospheres = defaultPlugin.addDefaultPhotorealScene();
  defaultAtmospheres.sun.update({
    sun: { intensity: 1, castShadow: true },
  });

  view.atmosphere.date.setHours(8);

  view.setCamera({
    lng: 139.6,
    lat: 35.48,
    height: 20000,
    heading: 0,
    pitch: -48,
    roll: 0,
  });

  // Selective outline effect
  const outlineEffect = view.addEffect({
    selectiveOutline: {
      color: new Color().setHex(0xff0000),
      thickness: 1.0,
      edgeStrength: 1.0,
    },
  });

  // MVT polygon with outline (Height Control District)
  const layer = view.addLayer({
    type: "mvt",
    data: { url: MVT_DATASETS.plateauTokyoHeightControl.url },
    polygon: {
      height: 0,
      extrudedHeight: 0,
      clampToGround: false,
      castShadow: true,
      receiveShadow: true,
      effectIds: [outlineEffect.id],
    },
    vectorTile: { maxZoom: 16 },
  });

  layer.on("featureUpdated", ({ evaluator }) => {
    evaluator.evaluate(
      ({ properties }) => {
        const attributes = JSON.parse(
          (properties?.["attributes"] as string) ?? "{}",
        );
        const minHeight = attributes["urf:minimumBuildingHeight"];
        const maxHeight = attributes["urf:maximumBuildingHeight"];
        const extrudedHeight = Math.max(maxHeight ?? minHeight ?? 0, 1);

        const color = (() => {
          if (extrudedHeight <= 1) return new Color().setHex(0x00ff00);
          if (extrudedHeight < 10) return new Color().setHex(0xffff00);
          if (extrudedHeight < 30) return new Color().setHex(0xff00ff);
          return new Color().setHex(0xff0000);
        })();

        return { color, extrudedHeight: extrudedHeight * 100 };
      },
      { filters: ["attributes"] },
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
    MVT_DATASETS.plateauTokyoHeightControl,
  ]);
};

run();
