import ThreeView, {
  Color,
  JAPAN_GSI_ELEVATION_DECODER,
} from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";

import {
  MVT_DATASETS,
  TERRAIN_DATASETS,
  TILE_DATASETS,
} from "../../../helpers/constants";
import { atZoneTime } from "../../../helpers/control";

const run = async () => {
  const view = new ThreeView<DefaultDescriptions>({
    debug: true,
    shadow: true,
  });

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  const attribution = view.attribution;

  await view.init();

  const defaultAtmospheres = defaultPlugin.addDefaultPhotorealScene();
  defaultAtmospheres.sun.update({
    sun: { intensity: 1, castShadow: true },
  });

  view.atmosphere.date = atZoneTime(view.atmosphere.date, 8);

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
  const heightControlSource = view.addSource({
    type: "vector-tile",
    url: MVT_DATASETS.plateauTokyoHeightControl.url,
    maxZoom: 16,
  });
  const layer = view.addLayer({
    type: "vector",
    source: heightControlSource,
    polygon: {
      height: 0,
      extrudedHeight: 0,
      clampToGround: false,
      castShadow: true,
      receiveShadow: true,
      effectIds: [outlineEffect.id],
    },
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
  const terrainDem = view.addSource({
    type: "raster-dem",
    url: TERRAIN_DATASETS.gsi.url,
    maxZoom: 15,
    minZoom: 5,
    elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
  });
  view.addLayer({
    type: "terrain",
    source: terrainDem,
    terrain: {
      castShadow: true,
      receiveShadow: true,
    },
  });

  view.addLayer({
    type: "raster",
    source: terrainDem,
    hillshade: {},
  });

  const openstreetmap = view.addSource({
    type: "raster-tile",
    url: TILE_DATASETS.openstreetmap.url,
    maxZoom: 23,
  });
  view.addLayer({
    type: "raster",
    source: openstreetmap,
  });

  attribution?.add([
    TILE_DATASETS.openstreetmap,
    TERRAIN_DATASETS.gsi,
    MVT_DATASETS.plateauTokyoHeightControl,
  ]);
};

run();
