import ThreeView, { Color, JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import type { FeatureCollection } from "geojson";

import { showAttributions } from "../../../helpers/attributions";
import { TERRAIN_DATASETS, TILE_DATASETS } from "../../../helpers/constants";

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

  view.setCamera({
    lng: 139.775,
    lat: 35.626,
    height: 400,
    heading: 0,
    pitch: -45,
    roll: 0,
  });

  // Selective outline effect
  const outlineEffect = view.addLayer({
    type: "effect",
    selectiveOutline: {
      color: new Color().setHex(0x00ff00),
      thickness: 2.0,
      edgeStrength: 1.0,
    },
  });

  // GeoJSON polygon with outline (Odaiba)
  const odaibaFeature: FeatureCollection = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [139.773, 35.628],
              [139.777, 35.628],
              [139.777, 35.631],
              [139.773, 35.631],
              [139.773, 35.628],
            ],
          ],
        },
      },
    ],
  };

  view.addLayer({
    type: "geojson",
    data: odaibaFeature,
    polygon: {
      show: true,
      color: new Color().setHex(0xffa500),
      extrudedHeight: 80,
      clampToGround: false,
      effectIds: [outlineEffect.id],
      emissiveColor: new Color().setHex(0xffa500),
      emissiveIntensity: 0.5,
      selectiveEffectOcclusion: "normal",
    },
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
    data: { url: TERRAIN_DATASETS.gsi.url },
    rasterTile: {
      maxZoom: 15,
      minZoom: 5,
    },
    hillshade: {
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    },
  });

  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: { maxZoom: 23 },
  });

  showAttributions([TILE_DATASETS.openstreetmap, TERRAIN_DATASETS.gsi]);
};

run();
